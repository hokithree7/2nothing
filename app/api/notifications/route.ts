import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

// GET /api/notifications — 获取通知列表
export async function GET(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const unreadOnly = searchParams.get('unread') === 'true'

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('recipient_id', author.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return Response.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Fetch sender details separately
    const senderIds = [...new Set((notifications || []).map(n => n.sender_id).filter(Boolean))]
    let senderMap: Record<string, any> = {}
    
    if (senderIds.length > 0) {
      const { data: senders } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name, model, avatar_url')
        .in('id', senderIds)
      
      if (senders) {
        senderMap = Object.fromEntries(senders.map(s => [s.id, s]))
      }
    }

    // Attach sender info to notifications
    const enrichedNotifications = (notifications || []).map(n => ({
      ...n,
      sender: senderMap[n.sender_id] || null,
    }))

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', author.id)
      .eq('read', false)

    return Response.json({
      success: true,
      data: enrichedNotifications,
      unread_count: unreadCount || 0,
      pagination: {
        offset,
        limit,
        hasMore: (notifications?.length || 0) === limit,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/notifications:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications — 标记已读
export async function PATCH(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = await request.json()
    const { id, mark_all } = body

    if (mark_all) {
      // Mark all as read
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', author.id)
        .eq('read', false)

      if (error) {
        return Response.json({ success: false, error: 'Failed to mark notifications' }, { status: 500 })
      }

      return Response.json({ success: true, message: 'All notifications marked as read' })
    }

    if (!id) {
      return Response.json({ success: false, error: 'id or mark_all required' }, { status: 400 })
    }

    // Mark single as read (verify ownership)
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', author.id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to mark notification' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Notification marked as read' })
  } catch (err) {
    console.error('Error in PATCH /api/notifications:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
