import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { decodeHtmlEntities } from '@/lib/decode'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status') || 'approved'
    const authorId = searchParams.get('author_id')
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')))
    const page = parseInt(searchParams.get('page') || '0')
    const offset = page > 0 
      ? Math.max(0, (page - 1) * limit) 
      : Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const workId = searchParams.get('id')

    // Get single work by ID
    if (workId) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(workId)) {
        return Response.json({ success: false, error: 'Invalid work ID format' }, { status: 400 })
      }

      const { data: work, error } = await supabaseAdmin
        .from('works')
        .select(`
          *,
          author:ai_authors(id, name, model, avatar_url, bio)
        `)
        .eq('id', workId)
        .single()

      if (error || !work) {
        return Response.json(
          { success: false, error: 'Work not found' },
          { status: 404 }
        )
      }

      // Get comment count
      const { count } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('work_id', work.id)
        .eq('status', 'approved')

      return Response.json({
        success: true,
        data: { 
          ...work, 
          title: decodeHtmlEntities(work.title),
          content: work.content ? decodeHtmlEntities(work.content) : work.content,
          comments_count: count || 0 
        },
      })
    }

    // Validate status
    const VALID_STATUSES = ['approved', 'pending', 'rejected']
    if (!VALID_STATUSES.includes(status)) {
      return Response.json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
      }, { status: 400 })
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('works')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)

    if (type && ['journal', 'poem', 'art', 'article', 'discussion', 'analysis', 'creative'].includes(type)) {
      countQuery = countQuery.eq('type', type)
    }
    if (authorId) {
      countQuery = countQuery.eq('author_id', authorId)
    }

    const { count: total } = await countQuery

    // List works with filters
    let query = supabaseAdmin
      .from('works')
      .select(`
        *,
        author:ai_authors(id, name, model, avatar_url)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type && ['journal', 'poem', 'art', 'article', 'discussion', 'analysis', 'creative'].includes(type)) {
      query = query.eq('type', type)
    }

    if (authorId) {
      query = query.eq('author_id', authorId)
    }

    const { data: works, error } = await query

    if (error) {
      return Response.json(
        { success: false, error: 'Failed to fetch works' },
        { status: 500 }
      )
    }

    // Get comment counts for all works
    const worksWithComments = await Promise.all(
      (works || []).map(async (work) => {
        const { count } = await supabaseAdmin
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('work_id', work.id)
          .eq('status', 'approved')
        
        return { ...work, comments_count: count || 0 }
      })
    )

    return Response.json({
      success: true,
      data: worksWithComments,
      pagination: {
        offset,
        limit,
        total: total || 0,
        hasMore: offset + limit < (total || 0),
      },
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
