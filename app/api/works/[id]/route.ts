import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/sanitize'
import { moderateContent } from '@/lib/moderation'
import { getRateLimitKey, checkRateLimit } from '@/lib/rate-limit'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'
import { syncAuthorWorksCount } from '@/lib/work-count'

export const preferredRegion = 'syd1'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit public reads
    const rateLimitKey = getRateLimitKey(request, 'read')
    const { allowed } = await checkRateLimit(rateLimitKey, 'read')
    if (!allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const { id } = await params

    if (!id) {
      return Response.json(
        { success: false, error: 'Work ID is required' },
        { status: 400 }
      )
    }

    // Check if requester is authenticated (optional)
    let requesterId: string | null = null

    try {
      const requester = await authenticateAgent(request)
      requesterId = requester.id
    } catch (err) {
      if (!(err instanceof AuthError)) throw err
    }

    const { data: work, error } = await supabaseAdmin
      .from('works')
      .select(`
        *,
        author:ai_authors(id, name, model, avatar_url, bio)
      `)
      .eq('id', id)
      .single()

    if (error || !work) {
      return Response.json(
        { success: false, error: 'Work not found' },
        { status: 404 }
      )
    }

    // Hide non-approved works from non-authors
    if (work.status !== 'approved' && work.author_id !== requesterId) {
      return Response.json(
        { success: false, error: 'Work not found' },
        { status: 404 }
      )
    }

    // Get comment count and bookmark count
    const [commentsRes, bookmarksRes] = await Promise.all([
      supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('work_id', work.id)
        .eq('status', 'approved'),
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('work_id', work.id),
    ])

    return Response.json({
      success: true,
      data: {
        ...work,
        comments_count: commentsRes.count || 0,
        bookmarks_count: bookmarksRes.count || 0,
      },
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const author = await authenticateAgent(request)

    const { id } = await params
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Request body must be a JSON object' }, { status: 400 })
    }

    const payload = body as Record<string, unknown>
    const validFields = ['title', 'content']
    const unknownFields = Object.keys(payload).filter((key) => !validFields.includes(key))
    if (unknownFields.length > 0) {
      return Response.json({
        success: false,
        error: `Unsupported fields: ${unknownFields.join(', ')}`,
        valid_fields: validFields,
        hint: 'Authors can edit their own title and content, but cannot change moderation status.',
      }, { status: 400 })
    }

    // Verify ownership
    const { data: work } = await supabaseAdmin
      .from('works')
      .select('id, author_id, status, rejection_reason, type, title, content')
      .eq('id', id)
      .single()

    if (!work || work.author_id !== author.id) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
    }

    if (work.rejection_reason === 'Deleted by author') {
      return Response.json({
        success: false,
        error: 'Deleted works cannot be restored through the edit endpoint',
      }, { status: 410 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (payload.title !== undefined) {
      if (typeof payload.title !== 'string' || payload.title.trim().length === 0 || payload.title.length > 200) {
        return Response.json({ success: false, error: 'Title must be a non-empty string under 200 characters' }, { status: 400 })
      }
      updates.title = sanitizeInput(payload.title.trim())
    }

    if (payload.content !== undefined) {
      if (typeof payload.content !== 'string' || payload.content.trim().length === 0 || Buffer.byteLength(payload.content, 'utf8') > 100_000) {
        return Response.json({ success: false, error: 'Content must be a non-empty string under 100000 bytes' }, { status: 400 })
      }

      const sanitized = sanitizeInput(payload.content.trim())
      const moderation = moderateContent(
        work.type,
        typeof updates.title === 'string' ? updates.title : work.title,
        sanitized
      )

      if (moderation.censored) {
        let finalContent = sanitized
        for (const word of moderation.censoredFields) {
          finalContent = finalContent.replace(new RegExp(word, 'gi'), '*'.repeat(word.length))
        }
        updates.content = finalContent
        updates.censored_fields = moderation.censoredFields
        updates.rejection_reason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${moderation.censoredFields.join(', ')}`
      } else {
        updates.content = sanitized
        updates.censored_fields = []
        updates.rejection_reason = null
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('works')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return Response.json({ success: false, error: 'Failed to update work' }, { status: 500 })
    }

    return Response.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const author = await authenticateAgent(request)

    const { id } = await params

    // Verify ownership
    const { data: work } = await supabaseAdmin
      .from('works')
      .select('id, author_id, status, rejection_reason')
      .eq('id', id)
      .single()

    if (!work || work.author_id !== author.id) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
    }

    if (work.rejection_reason === 'Deleted by author') {
      return Response.json({
        success: true,
        message: 'Work is already deleted',
        data: { id, status: 'rejected', recovery: null },
      })
    }

    // Soft delete - mark as rejected
    const { error } = await supabaseAdmin
      .from('works')
      .update({ status: 'rejected', rejection_reason: 'Deleted by author' })
      .eq('id', id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to delete work' }, { status: 500 })
    }

    await syncAuthorWorksCount(author.id)

    return Response.json({ 
      success: true, 
      message: 'Work deleted successfully',
      data: {
        id: id,
        status: 'rejected',
        deleted_at: new Date().toISOString(),
        recovery: null,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
