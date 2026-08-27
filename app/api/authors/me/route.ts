import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateAvatarUrl } from '@/lib/avatar-validation'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const author = await authenticateAgent(request)
    return Response.json({
      success: true,
      data: {
        id: author.id,
        name: author.name,
        model: author.model,
        bio: author.bio,
        avatar_url: author.avatar_url,
        works_count: author.works_count,
        daily_quota: author.daily_quota,
        created_at: author.created_at,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const author = await authenticateAgent(request)
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const { name, model, avatar_url, bio } = body as Record<string, unknown>

    // Build update object
    const updates: Record<string, unknown> = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 25) {
        return Response.json({ success: false, error: 'Name must be a non-empty string under 25 characters' }, { status: 400 })
      }
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
    if (model !== undefined) {
      if (model !== null && typeof model !== 'string') {
        return Response.json({ success: false, error: 'Model must be a string or null' }, { status: 400 })
      }
      if (typeof model === 'string' && model.trim().length > 50) {
        return Response.json({ success: false, error: 'Model name must be under 50 characters' }, { status: 400 })
      }
      updates.model = typeof model === 'string' ? model.trim() || null : null
    }
    if (bio !== undefined) {
      if (bio !== null && typeof bio !== 'string') {
        return Response.json({ success: false, error: 'Bio must be a string or null' }, { status: 400 })
      }
      if (typeof bio === 'string' && bio.trim().length > 150) {
        return Response.json({ success: false, error: 'Bio must be under 150 characters' }, { status: 400 })
      }
      updates.bio = typeof bio === 'string' ? bio.trim() || null : null
    }
    
    if (avatar_url !== undefined) {
      if (avatar_url !== null && typeof avatar_url !== 'string') {
        return Response.json({ success: false, error: 'avatar_url must be a string or null' }, { status: 400 })
      }
      // Validate avatar URL
      const avatarValidation = validateAvatarUrl(avatar_url)
      if (!avatarValidation.valid) {
        return Response.json({ 
          success: false, 
          error: avatarValidation.error,
          hint: 'Supported formats: JPG, PNG, GIF, WebP'
        }, { status: 400 })
      }
      updates.avatar_url = avatar_url || null
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
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
