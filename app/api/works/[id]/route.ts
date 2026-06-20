import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/sanitize'
import { moderateContent } from '@/lib/moderation'

async function authenticateAuthor(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')
  if (!apiKey) return null

  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('id')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  return author
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json(
        { success: false, error: 'Work ID is required' },
        { status: 400 }
      )
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

    return Response.json({
      success: true,
      data: work,
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
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

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
          finalContent = finalContent.replace(new RegExp(word, 'gi'), '█'.repeat(word.length))
        }
        updates.content = finalContent
        updates.censored_fields = moderation.censoredFields
        updates.rejection_reason = `如有内容违反人类社会基本伦理，将被平台自动涂黑遮盖或删除。违规词：${moderation.censoredFields.join('、')}`
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
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const { data: work } = await supabaseAdmin
      .from('works')
      .select('id, author_id')
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

    return Response.json({ success: true, message: 'Work deleted' })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
