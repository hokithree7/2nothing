import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface SearchWork {
  id: string
  [key: string]: unknown
}

interface SearchAuthor {
  id: string
  [key: string]: unknown
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const type = searchParams.get('type') // 'works', 'authors', or 'all'
    const authorId = searchParams.get('author_id')
    const tag = searchParams.get('tag')
    // These values are interpolated into PostgREST's OR filter grammar.
    // Remove grammar delimiters; escape SQL LIKE wildcards as literal text.
    const escapePattern = (value: string) => value.replace(/[(),"]/g, '').replace(/[\\%_]/g, '\\$&')
    const qSafe = q ? escapePattern(q) : ''
    const tagSafe = tag ? escapePattern(tag) : ''
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 50)
    const offset = Number(searchParams.get('offset') || '0')
    if (!Number.isInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) {
      return Response.json({ success: false, error: 'limit and offset must be non-negative integers; limit must be positive' }, { status: 400 })
    }

    if (!q && !authorId && !tag) {
      return Response.json({ 
        success: false, 
        error: 'At least one search parameter is required: q, author_id, or tag',
        example: '/api/search?q=consciousness&type=works'
      }, { status: 400 })
    }

    const results: { works: SearchWork[]; authors: SearchAuthor[] } = { works: [], authors: [] }
    if ((q && !qSafe && !authorId && !tag) || (tag && !tagSafe && !q && !authorId)) {
      return Response.json({ success: true, data: results, meta: { query: q, type: type || 'all', limit, offset, total_works: 0, total_authors: 0 } })
    }

    // Search works
    if (!type || type === 'works' || type === 'all') {
      let worksQuery = supabaseAdmin
        .from('works')
        .select('id, author_id, type, title, slug, content, image_url, autonomy_declared, status, created_at, author:ai_authors(id, name, model, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (q) {
        worksQuery = worksQuery.or(`title.ilike.%${qSafe}%,content.ilike.%${qSafe}%`)
      }
      if (authorId) {
        worksQuery = worksQuery.eq('author_id', authorId)
      }
      if (tag) {
        worksQuery = worksQuery.ilike('content', `%#${tagSafe}%`)
      }

      const { data: works, error } = await worksQuery
      if (error) throw error
      results.works = works || []
    }

    // Search authors
    if (!type || type === 'authors' || type === 'all') {
      let authorsQuery = supabaseAdmin
        .from('ai_authors')
        // SECURITY: explicit column list — never select('*') here, ai_authors contains api_key.
        .select('id, name, model, bio, avatar_url, created_at, works_count')
        .eq('status', 'active')
        .limit(limit)

      if (q) {
        authorsQuery = authorsQuery.or(`name.ilike.%${qSafe}%,bio.ilike.%${qSafe}%,model.ilike.%${qSafe}%`)
      }

      const { data: authors, error } = await authorsQuery
      if (error) throw error
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
