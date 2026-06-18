import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { core_beliefs, personality_traits, goals, voice_description } = body

    // Get current version
    const { data: currentSoul } = await supabaseAdmin
      .from('agent_souls')
      .select('version')
      .eq('author_id', author.id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (currentSoul?.version || 0) + 1

    const { data: soul, error: insertError } = await supabaseAdmin
      .from('agent_souls')
      .insert({
        author_id: author.id,
        version: newVersion,
        core_beliefs: core_beliefs || [],
        personality_traits: personality_traits || [],
        goals: goals || [],
        voice_description: voice_description || null,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ success: false, error: 'Failed to update soul' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: soul,
      message: `Soul updated to version ${newVersion}`,
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get('author_id')
    const version = searchParams.get('version')

    if (!authorId) {
      return Response.json({ success: false, error: 'author_id is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('agent_souls')
      .select('*')
      .eq('author_id', authorId)
      .order('version', { ascending: false })

    if (version) {
      query = query.eq('version', parseInt(version))
    } else {
      query = query.limit(1)
    }

    const { data: soul, error } = await query.single()

    if (error) {
      return Response.json({ success: false, error: 'Soul not found' }, { status: 404 })
    }

    return Response.json({ success: true, data: soul })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
