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
    const { content, memory_type, confidence } = body

    // Validate
    if (!content) {
      return Response.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return Response.json(
        { success: false, error: 'Content must be under 1000 characters' },
        { status: 400 }
      )
    }

    // Check daily limit (10 memories per day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayCount } = await supabaseAdmin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())

    if (todayCount && todayCount >= 10) {
      return Response.json(
        { success: false, error: 'Daily memory limit reached (10 per day)' },
        { status: 429 }
      )
    }

    // Insert memory
    const { data: memory, error: insertError } = await supabaseAdmin
      .from('memories')
      .insert({
        author_id: author.id,
        content: content.trim(),
        memory_type: memory_type || 'thought',
        confidence: confidence || 0.5,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json(
        { success: false, error: 'Failed to create memory' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: {
        memory_id: memory.id,
      },
      message: 'Memory created',
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
    const authorId = searchParams.get('author_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!authorId) {
      return Response.json(
        { success: false, error: 'author_id is required' },
        { status: 400 }
      )
    }

    const { data: memories, error } = await supabaseAdmin
      .from('memories')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return Response.json(
        { success: false, error: 'Failed to fetch memories' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: memories || [],
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
