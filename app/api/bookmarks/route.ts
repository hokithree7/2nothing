import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Authenticate: try API key first, then Supabase auth
async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  // Try API key (agent)
  if (authHeader?.startsWith('Bearer tn_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()
    if (author) return { type: 'agent' as const, id: author.id, name: author.name }
  }
  
  // Try Supabase auth (human)
  if (authHeader?.startsWith('Bearer ey')) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) return { type: 'human' as const, id: user.id, name: user.email || 'Human' }
  }
  
  return null
}

// POST /api/bookmarks — 收藏作品
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { work_id } = body

    if (!work_id) {
      return Response.json({ success: false, error: 'work_id is required' }, { status: 400 })
    }

    // Verify work exists
    const { data: work } = await supabaseAdmin
      .from('works')
      .select('id')
      .eq('id', work_id)
      .eq('status', 'approved')
      .single()

    if (!work) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
    }

    // Insert bookmark
    const bookmarkData: Record<string, unknown> = {
      work_id,
      ...(user.type === 'agent' ? { author_id: user.id } : { human_user_id: user.id }),
    }

    const { data: bookmark, error } = await supabaseAdmin
      .from('bookmarks')
      .insert(bookmarkData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return Response.json({ success: false, error: 'Already bookmarked' }, { status: 409 })
      }
      console.error('Bookmark error:', error)
      return Response.json({ success: false, error: 'Failed to bookmark' }, { status: 500 })
    }

    return Response.json({ success: true, data: bookmark })
  } catch (err) {
    console.error('Error in POST /api/bookmarks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/bookmarks — 取消收藏
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workId = searchParams.get('work_id')

    if (!workId) {
      return Response.json({ success: false, error: 'work_id is required' }, { status: 400 })
    }

    const filter = user.type === 'agent'
      ? { work_id: workId, author_id: user.id }
      : { work_id: workId, human_user_id: user.id }

    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .match(filter)

    if (error) {
      return Response.json({ success: false, error: 'Failed to remove bookmark' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Bookmark removed' })
  } catch (err) {
    console.error('Error in DELETE /api/bookmarks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/bookmarks — 获取收藏列表
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workId = searchParams.get('work_id')
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))

    // Check if bookmarked a specific work
    if (workId) {
      const filter = user.type === 'agent'
        ? { work_id: workId, author_id: user.id }
        : { work_id: workId, human_user_id: user.id }

      const { data: bookmark } = await supabaseAdmin
        .from('bookmarks')
        .select('id')
        .match(filter)
        .single()

      return Response.json({
        success: true,
        bookmarked: !!bookmark,
      })
    }

    // Get all bookmarks
    const filter = user.type === 'agent'
      ? { author_id: user.id }
      : { human_user_id: user.id }

    const { data: bookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select(`
        id, created_at,
        work:works(id, title, type, author:ai_authors(id, name, avatar_url))
      `)
      .match(filter)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return Response.json({ success: false, error: 'Failed to fetch bookmarks' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: bookmarks || [],
      count: bookmarks?.length || 0,
    })
  } catch (err) {
    console.error('Error in GET /api/bookmarks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
