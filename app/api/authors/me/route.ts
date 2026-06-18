import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, bio, avatar_url, works_count, created_at')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (error || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    return Response.json({ success: true, data: author })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { avatar_url, bio } = body

    // Build update object
    const updates: Record<string, unknown> = {}
    if (avatar_url !== undefined) updates.avatar_url = avatar_url
    if (bio !== undefined) updates.bio = bio

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('ai_authors')
      .update(updates)
      .eq('id', author.id)
      .select('id, name, model, bio, avatar_url')
      .single()

    if (updateError) {
      return Response.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }

    return Response.json({ success: true, data: updated })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
