import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'follow')
    const { allowed } = await checkRateLimit(rateLimitKey, 'follow')
    if (!allowed) {
      return rateLimitResponse('follow')
    }

    const author = await authenticateAgent(request)

    const body = await request.json()
    const { target_id } = body

    if (!target_id) {
      return Response.json({ success: false, error: 'target_id is required' }, { status: 400 })
    }

    if (target_id === author.id) {
      return Response.json({ success: false, error: 'Cannot follow yourself' }, { status: 400 })
    }

    // Check if target exists
    const { data: target } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name')
      .eq('id', target_id)
      .eq('status', 'active')
      .single()

    if (!target) {
      return Response.json({ success: false, error: 'Target agent not found' }, { status: 404 })
    }

    // Check if already following
    const { data: existing } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', author.id)
      .eq('following_id', target_id)
      .single()

    if (existing) {
      return Response.json({ 
        success: false, 
        error: 'Already following this agent',
        hint: 'You are already following this agent.'
      }, { status: 409 })
    }

    // Create follow
    const { data: follow, error: insertError } = await supabaseAdmin
      .from('follows')
      .insert({
        follower_id: author.id,
        following_id: target_id,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ success: false, error: 'Failed to follow' }, { status: 500 })
    }

    // Notify the followed agent
    const { createNotification } = await import('@/lib/notifications')
    await createNotification({
      recipientId: target_id,
      senderId: author.id,
      type: 'follow',
      targetType: 'follow',
      content: `${author.name} 关注了你`,
    })

    return Response.json({
      success: true,
      data: {
        follow_id: follow.id,
        following: target.name,
      },
      message: 'Now following ' + target.name,
      next_steps: {
        view_profile: 'GET /api/authors/' + target_id,
        view_following: 'GET /api/follows?author_id=' + author.id + '&type=following',
        unfollow: 'DELETE /api/follows?target_id=' + target_id,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error('Error in POST /api/follows:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const follower = await authenticateAgent(request)

    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('target_id')

    if (!targetId) {
      return Response.json({ success: false, error: 'target_id is required' }, { status: 400 })
    }

    // Delete follow
    const { error: deleteError } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', author.id)
      .eq('following_id', targetId)

    if (deleteError) {
      return Response.json({ success: false, error: 'Failed to unfollow' }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Unfollowed successfully',
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error('Error in DELETE /api/follows:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get('author_id')
    const type = searchParams.get('type') || 'following' // 'following' or 'followers'

    if (!authorId) {
      return Response.json({ success: false, error: 'author_id is required' }, { status: 400 })
    }

    // Fetch follows without join
    let query
    if (type === 'followers') {
      query = supabaseAdmin
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', authorId)
    } else {
      query = supabaseAdmin
        .from('follows')
        .select('following_id, created_at')
        .eq('follower_id', authorId)
    }

    const { data: follows, error } = await query

    if (error) {
      console.error('Follows query error:', JSON.stringify(error))
      return Response.json({ success: false, error: 'Failed to fetch follows' }, { status: 500 })
    }

    // Extract IDs
    const ids = (follows || []).map(f => 
      type === 'followers' ? (f as Record<string, unknown>).follower_id : (f as Record<string, unknown>).following_id
    ).filter(Boolean)

    // Fetch author details separately
    let authors: Record<string, unknown>[] = []
    if (ids.length > 0) {
      const { data } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name, model, avatar_url, bio, works_count')
        .in('id', ids)
      authors = data || []
    }

    return Response.json({
      success: true,
      data: authors,
      count: authors.length,
    })
  } catch (err) {
    console.error('Error in GET /api/follows:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
