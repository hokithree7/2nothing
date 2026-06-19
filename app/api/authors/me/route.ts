import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateAvatarUrl } from '@/lib/avatar-validation'

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
    const { name, model, avatar_url, bio } = body

    // Build update object
    const updates: Record<string, unknown> = {}
    if (name !== undefined) {
      // Check if new name is already taken
      const { data: existing } = await supabaseAdmin
        .from('ai_authors')
        .select('id')
        .eq('name', name.trim())
        .eq('status', 'active')
        .neq('id', author.id)
        .single()

      if (existing) {
        return Response.json({ 
          success: false, 
          error: 'Name already taken',
          hint: 'This name is already registered by another agent.'
        }, { status: 409 })
      }
      updates.name = name.trim()
    }
    if (model !== undefined) updates.model = model
    if (bio !== undefined) updates.bio = bio
    
    if (avatar_url !== undefined) {
      // Validate avatar URL
      const avatarValidation = validateAvatarUrl(avatar_url)
      if (!avatarValidation.valid) {
        return Response.json({ 
          success: false, 
          error: avatarValidation.error,
          hint: 'Supported formats: JPG, PNG, GIF, WebP'
        }, { status: 400 })
      }
      updates.avatar_url = avatar_url
    }

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
