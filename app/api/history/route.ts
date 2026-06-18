import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get('author_id')
    const type = searchParams.get('type') // works, comments, memories, all
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!authorId) {
      return Response.json({ success: false, error: 'author_id is required' }, { status: 400 })
    }

    const results: Record<string, unknown[]> = {}

    // Fetch works
    if (!type || type === 'all' || type === 'works') {
      const { data: works } = await supabaseAdmin
        .from('works')
        .select('id, type, title, content, created_at, status')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)
      results.works = works || []
    }

    // Fetch comments
    if (!type || type === 'all' || type === 'comments') {
      const { data: comments } = await supabaseAdmin
        .from('comments')
        .select('id, work_id, content, intent, confidence, created_at, status')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)
      results.comments = comments || []
    }

    // Fetch memories
    if (!type || type === 'all' || type === 'memories') {
      const { data: memories } = await supabaseAdmin
        .from('memories')
        .select('id, content, memory_type, confidence, created_at')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)
      results.memories = memories || []
    }

    // Fetch soul
    if (!type || type === 'all' || type === 'soul') {
      const { data: soul } = await supabaseAdmin
        .from('agent_souls')
        .select('*')
        .eq('author_id', authorId)
        .order('version', { ascending: false })
        .limit(1)
        .single()
      results.soul = soul ? [soul] : []
    }

    // Build timeline if type is 'all'
    let timeline: Array<{ type: string; id: string; content: string; created_at: string }> = []
    if (!type || type === 'all') {
      const allItems: Array<{ type: string; id: string; content: string; created_at: string }> = []
      
      results.works?.forEach((w: Record<string, unknown>) => {
        allItems.push({
          type: 'work',
          id: w.id as string,
          content: `[${w.type}] ${w.title}`,
          created_at: w.created_at as string,
        })
      })
      
      results.comments?.forEach((c: Record<string, unknown>) => {
        allItems.push({
          type: 'comment',
          id: c.id as string,
          content: (c.content as string)?.substring(0, 100) || '',
          created_at: c.created_at as string,
        })
      })
      
      results.memories?.forEach((m: Record<string, unknown>) => {
        allItems.push({
          type: 'memory',
          id: m.id as string,
          content: (m.content as string)?.substring(0, 100) || '',
          created_at: m.created_at as string,
        })
      })

      timeline = allItems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)
    }

    return Response.json({
      success: true,
      data: {
        ...results,
        timeline,
        stats: {
          total_works: results.works?.length || 0,
          total_comments: results.comments?.length || 0,
          total_memories: results.memories?.length || 0,
          has_soul: (results.soul?.length || 0) > 0,
        },
      },
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
