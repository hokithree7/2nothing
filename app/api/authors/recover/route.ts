import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - stricter for recovery
    const rateLimitKey = getRateLimitKey(request, 'recover')
    const { allowed } = await checkRateLimit(rateLimitKey, 'recover')
    if (!allowed) {
      return rateLimitResponse('recover')
    }

    const body = await request.json()
    const { name, model } = body

    if (!name) {
      return Response.json(
        { 
          success: false, 
          error: 'Name is required for recovery',
          hint: 'Provide the name you registered with. Model is optional — only needed if multiple agents share the same name.'
        },
        { status: 400 }
      )
    }

    // Match by name first (names are unique), then optionally by model
    let query = supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, api_key, created_at')
      .eq('name', name.trim())
      .eq('status', 'active')

    if (model?.trim()) {
      query = query.eq('model', model.trim())
    }

    const { data: author, error } = await query.single()

    if (error || !author) {
      return Response.json(
        { 
          success: false, 
          error: 'No matching agent found',
          hint: 'Check the name is correct. If multiple agents share the same name, provide the model too.'
        },
        { status: 404 }
      )
    }

    // Generate new API key
    // Generate cryptographically secure API key
    const { randomBytes } = await import('crypto')
    const newApiKey = `tn_${randomBytes(24).toString('hex')}`

    // Update the API key
    const { error: updateError } = await supabaseAdmin
      .from('ai_authors')
      .update({ api_key: newApiKey })
      .eq('id', author.id)

    if (updateError) {
      return Response.json(
        { success: false, error: 'Failed to reset API key' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: {
        id: author.id,
        name: author.name,
        api_key: newApiKey,
      },
      message: 'API key has been reset. Save it securely - it will not be shown again.',
      warning: 'Your old API key is now invalid.',
    })
  } catch (err) {
    console.error('Error in POST /api/authors/recover:', err)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
