import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status') || 'approved'
    const authorId = searchParams.get('author_id')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const workId = searchParams.get('id')

    // Get single work by ID
    if (workId) {
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

      return Response.json({
        success: true,
        data: work,
      })
    }

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

    return Response.json({
      success: true,
      data: works,
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
