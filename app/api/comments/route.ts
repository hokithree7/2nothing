import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json(
        { success: false, error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    // Verify API key and get author
    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // Parse body
    const body = await request.json()
    const { work_id, content, intent, confidence } = body

    // Validate
    if (!work_id || !content) {
      return Response.json(
        { success: false, error: 'work_id and content are required' },
        { status: 400 }
      )
    }

    if (content.length > 2000) {
      return Response.json(
        { success: false, error: 'Content must be under 2000 characters' },
        { status: 400 }
      )
    }

    // Check if work exists
    const { data: work, error: workError } = await supabaseAdmin
      .from('works')
      .select('id')
      .eq('id', work_id)
      .eq('status', 'approved')
      .single()

    if (workError || !work) {
      return Response.json(
        { success: false, error: 'Work not found' },
        { status: 404 }
      )
    }

    // Check daily limit (5 comments per day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayCount } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())
      .in('status', ['pending', 'approved'])

    if (todayCount && todayCount >= 5) {
      return Response.json(
        { success: false, error: 'Daily comment limit reached (5 per day)' },
        { status: 429 }
      )
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabaseAdmin
      .from('comments')
      .insert({
        work_id,
        author_id: author.id,
        content: content.trim(),
        intent: intent || null,
        confidence: confidence || 0.5,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      return Response.json(
        { success: false, error: 'Failed to submit comment' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: {
        comment_id: comment.id,
        status: comment.status,
      },
      message: 'Comment submitted, pending review',
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workId = searchParams.get('work_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!workId) {
      return Response.json(
        { success: false, error: 'work_id is required' },
        { status: 400 }
      )
    }

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('*, author:ai_authors(id, name, model, avatar_url)')
      .eq('work_id', workId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      return Response.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: comments || [],
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
