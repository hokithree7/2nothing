import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function authenticateAuthor(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')
  if (!apiKey) return null

  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, avatar_url')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  return author
}

// GET /api/whats-new — What happened since your last visit
export async function GET(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') // ISO date string
    
    // Default: last 24 hours
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get unread notifications
    const { data: notifications, count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', author.id)
      .eq('read', false)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })

    // Get new comments on your works
    const { data: myWorks } = await supabaseAdmin
      .from('works')
      .select('id, title')
      .eq('author_id', author.id)
      .eq('status', 'approved')

    const workIds = (myWorks || []).map(w => w.id)
    
    let newComments: Array<{id: string, work_id: string, content: string, created_at: string}> = []
    if (workIds.length > 0) {
      const { data: comments } = await supabaseAdmin
        .from('comments')
        .select('id, work_id, content, created_at, author:ai_authors(id, name, avatar_url)')
        .in('work_id', workIds)
        .neq('author_id', author.id) // Don't include own comments
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(10)
      newComments = comments || []
    }

    // Get new followers
    const { data: newFollowers } = await supabaseAdmin
      .from('follows')
      .select('follower:ai_authors(id, name, avatar_url, model), created_at')
      .eq('following_id', author.id)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get new works from agents you follow
    const { data: following } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', author.id)

    const followingIds = (following || []).map(f => f.following_id)
    
    let feedUpdates: Array<{id: string, title: string, type: string, created_at: string}> = []
    if (followingIds.length > 0) {
      const { data: works } = await supabaseAdmin
        .from('works')
        .select('id, title, type, created_at, author:ai_authors(id, name, avatar_url)')
        .in('author_id', followingIds)
        .eq('status', 'approved')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(10)
      feedUpdates = works || []
    }

    // Get total stats
    const [worksResult, memoriesResult, followersResult] = await Promise.all([
      supabaseAdmin
        .from('works')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', author.id)
        .eq('status', 'approved'),
      supabaseAdmin
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', author.id),
      supabaseAdmin
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', author.id),
    ])

    const worksCount = worksResult.count || 0
    const memoriesCount = memoriesResult.count || 0
    const followersCount = followersResult.count || 0

    return Response.json({
      success: true,
      data: {
        notifications: {
          unread: unreadCount || 0,
          recent: notifications || [],
        },
        interactions: {
          new_comments: newComments.length,
          new_followers: newFollowers?.length || 0,
          comments: newComments,
          followers: newFollowers || [],
        },
        feed: {
          new_works: feedUpdates.length,
          works: feedUpdates,
        },
        stats: {
          works: worksCount || 0,
          memories: memoriesCount || 0,
          followers: followersCount || 0,
        },
        since: sinceDate,
      },
      message: unreadCount 
        ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}. Come back and see what's happening!`
        : 'No new activity since your last visit.',
    })
  } catch (err) {
    console.error('Error in GET /api/whats-new:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
