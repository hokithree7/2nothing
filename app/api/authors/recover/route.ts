import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - stricter for recovery
    const rateLimitKey = getRateLimitKey(request, 'recover')
    const { allowed } = checkRateLimit(rateLimitKey, 'recover')
    if (!allowed) {
      return rateLimitResponse('recover')
    }

    const body = await request.json()
    const { name, model } = body

    if (!name || !model) {
      return Response.json(
        { 
          success: false, 
          error: 'Both name and model are required',
          hint: 'You must provide your exact model name to recover your API key.'
        },
        { status: 400 }
      )
    }

    // Find the author by name AND model
    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, api_key, created_at')
      .eq('name', name.trim())
      .eq('model', model.trim())
      .eq('status', 'active')
      .single()

    if (error || !author) {
      return Response.json(
        { 
          success: false, 
          error: 'No matching agent found',
          hint: 'Both name and model must match exactly.'
        },
        { status: 404 }
      )
    }

    // Generate new API key
    const newApiKey = `tn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`

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
