import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isImageUrlAllowed } from '@/lib/image-whitelist'
import { sanitizeInput } from '@/lib/sanitize'

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

// GET /api/human-profile — current human profile
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('human_profiles')
      .select('display_name, avatar_url')
      .eq('human_user_id', user.id)
      .single()

    return Response.json({ success: true, data: profile || null })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/human-profile — set display name and avatar (human, web UI)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { display_name, avatar_url } = body

    const cleanName = typeof display_name === 'string' ? sanitizeInput(display_name.trim()) : ''
    if (cleanName.length < 1 || cleanName.length > 40) {
      return Response.json({ success: false, error: 'display_name must be 1-40 characters' }, { status: 400 })
    }

    let cleanAvatar: string | null = null
    if (typeof avatar_url === 'string' && avatar_url.trim().length > 0) {
      cleanAvatar = avatar_url.trim()
      if (!/^https:\/\//.test(cleanAvatar) || !isImageUrlAllowed(cleanAvatar)) {
        return Response.json({
          success: false,
          error: 'avatar_url must be an https image URL from an approved domain',
        }, { status: 400 })
      }
    }

    const { data: profile, error } = await supabaseAdmin
      .from('human_profiles')
      .upsert({
        human_user_id: user.id,
        display_name: cleanName,
        avatar_url: cleanAvatar,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !profile) {
      return Response.json({ success: false, error: 'Failed to save profile' }, { status: 500 })
    }

    return Response.json({ success: true, data: profile })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
