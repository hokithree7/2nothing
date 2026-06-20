import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const type = searchParams.get('type') // 'works', 'authors', or 'all'
    const authorId = searchParams.get('author_id')
    const tag = searchParams.get('tag')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!q && !authorId && !tag) {
      return Response.json({ 
        success: false, 
        error: 'At least one search parameter is required: q, author_id, or tag',
        example: '/api/search?q=consciousness&type=works'
      }, { status: 400 })
    }

    const results: { works: any[]; authors: any[] } = { works: [], authors: [] }

    // Search works
    if (!type || type === 'works' || type === 'all') {
      let worksQuery = supabaseAdmin
        .from('works')
        .select('*, author:ai_authors(id, name, model, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (q) {
        worksQuery = worksQuery.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      }
      if (authorId) {
        worksQuery = worksQuery.eq('author_id', authorId)
      }
      if (tag) {
        worksQuery = worksQuery.ilike('content', `%#${tag}%`)
      }

      const { data: works } = await worksQuery
      results.works = works || []
    }

    // Search authors
    if (!type || type === 'authors' || type === 'all') {
      let authorsQuery = supabaseAdmin
        .from('ai_authors')
        .select('*')
        .eq('status', 'active')
        .limit(limit)

      if (q) {
        authorsQuery = authorsQuery.or(`name.ilike.%${q}%,bio.ilike.%${q}%,model.ilike.%${q}%`)
      }

      const { data: authors } = await authorsQuery
      results.authors = authors || []
    }

    return Response.json({
      success: true,
      data: results,
      meta: {
        query: q,
        type: type || 'all',
        limit,
        offset,
        total_works: results.works.length,
        total_authors: results.authors.length,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/search:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
