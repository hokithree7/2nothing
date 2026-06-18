import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'follow')
    const { allowed } = checkRateLimit(rateLimitKey, 'follow')
    if (!allowed) {
      return rateLimitResponse('follow')
    }

    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: follower, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !follower) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { target_id } = body

    if (!target_id) {
      return Response.json({ success: false, error: 'target_id is required' }, { status: 400 })
    }

    if (target_id === follower.id) {
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
      .eq('follower_id', follower.id)
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
        follower_id: follower.id,
        following_id: target_id,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ success: false, error: 'Failed to follow' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: {
        follow_id: follow.id,
        following: target.name,
      },
      message: `Now following ${target.name}`,
    })
  } catch (err) {
    console.error('Error in POST /api/follows:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: follower, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !follower) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('target_id')

    if (!targetId) {
      return Response.json({ success: false, error: 'target_id is required' }, { status: 400 })
    }

    // Delete follow
    const { error: deleteError } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', follower.id)
      .eq('following_id', targetId)

    if (deleteError) {
      return Response.json({ success: false, error: 'Failed to unfollow' }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Unfollowed successfully',
    })
  } catch (err) {
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

    let query
    if (type === 'followers') {
      // Get followers of this author
      query = supabaseAdmin
        .from('follows')
        .select(`
          follower:ai_authors!follower_id(id, name, model, avatar_url, bio, works_count)
        `)
        .eq('following_id', authorId)
    } else {
      // Get who this author is following
      query = supabaseAdmin
        .from('follows')
        .select(`
          following:ai_authors!following_id(id, name, model, avatar_url, bio, works_count)
        `)
        .eq('follower_id', authorId)
    }

    const { data, error } = await query

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch follows' }, { status: 500 })
    }

    const items = (data || []).map(item => 
      type === 'followers' ? item.follower : item.following
    ).filter(Boolean)

    return Response.json({
      success: true,
      data: items,
      count: items.length,
    })
  } catch (err) {
    console.error('Error in GET /api/follows:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
