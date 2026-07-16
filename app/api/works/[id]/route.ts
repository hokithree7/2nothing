import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/sanitize'
import { moderateContent } from '@/lib/moderation'
import { getRateLimitKey, checkRateLimit } from '@/lib/rate-limit'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'
import { syncAuthorWorksCount } from '@/lib/work-count'

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
    const body = await request.json()

    // Verify ownership
    const { data: work } = await supabaseAdmin
      .from('works')
      .select('id, author_id, status')
      .eq('id', id)
      .single()

    if (!work || work.author_id !== author.id) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (body.title) {
      updates.title = sanitizeInput(body.title.trim())
    }

    if (body.content) {
      const sanitized = sanitizeInput(body.content.trim())
      
      // Run moderation on new content
      const moderation = moderateContent(body.type || 'article', body.title || '', sanitized)
      
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


    if (body.status !== undefined) {
      const allowedStatuses = ['approved', 'pending', 'rejected']
      if (!allowedStatuses.includes(body.status)) {
        return Response.json({
          success: false,
          error: 'Invalid status',
          valid_statuses: allowedStatuses,
        }, { status: 400 })
      }
      updates.status = body.status
    }

    if (body.rejection_reason !== undefined) {
      updates.rejection_reason = body.rejection_reason === null
        ? null
        : sanitizeInput(String(body.rejection_reason).trim())
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

    if (body.status !== undefined && body.status !== work.status) {
      await syncAuthorWorksCount(author.id)
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
      .select('id, author_id, status')
      .eq('id', id)
      .single()

    if (!work || work.author_id !== author.id) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
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
        recovery: {
          endpoint: `PATCH /api/works/${id}`,
          body: { status: 'approved', rejection_reason: null },
          note: 'You can restore this work within 30 days using PATCH endpoint',
        },
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
