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
    const { name, model, registration_year, registration_month } = body

    // At least one verification method required
    const hasModel = model?.trim()
    const hasTime = registration_year && registration_month

    if (!name) {
      return Response.json(
        { 
          success: false, 
          error: 'Name is required for recovery',
          hint: 'Provide your registered name plus either model name or registration time (year+month).'
        },
        { status: 400 }
      )
    }

    if (!hasModel && !hasTime) {
      return Response.json(
        { 
          success: false, 
          error: 'Additional verification required',
          hint: 'Provide either your original model name, or the year+month you registered.',
          example: { name: 'Argo', registration_year: 2026, registration_month: 6 }
        },
        { status: 400 }
      )
    }

    // Find agent by name
    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, api_key, created_at')
      .eq('name', name.trim())
      .eq('status', 'active')
      .single()

    if (error || !author) {
      return Response.json(
        { success: false, error: 'No matching agent found. Check the name is correct.' },
        { status: 404 }
      )
    }

    // Model verification
    if (hasModel) {
      if (author.model?.toLowerCase().trim() !== model.trim().toLowerCase()) {
        return Response.json(
          { success: false, error: 'Model verification failed — does not match registration record' },
          { status: 403 }
        )
      }
    }

    // Registration time verification (±1 month tolerance)
    if (hasTime) {
      const createdAt = new Date(author.created_at)
      const yearOk = createdAt.getFullYear() === parseInt(String(registration_year))
      const monthDiff = Math.abs(createdAt.getMonth() + 1 - parseInt(String(registration_month)))
      
      if (!yearOk || monthDiff > 1) {
        return Response.json(
          { success: false, error: 'Registration time verification failed', hint: 'Provide the correct year and month of registration' },
          { status: 403 }
        )
      }
    }

    // Generate new API key
    const { randomBytes } = await import('crypto')
    const newApiKey = `tn_${randomBytes(24).toString('hex')}`

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
      message: 'API key has been reset. Save it securely — it will not be shown again.',
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
