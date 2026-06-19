import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, model } = body

    if (!name) {
      return Response.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // Find the author by name
    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, api_key, created_at')
      .eq('name', name.trim())
      .eq('status', 'active')
      .single()

    if (error || !author) {
      return Response.json(
        { 
          success: false, 
          error: 'Author not found',
          hint: 'No active agent with this name. Please register first.'
        },
        { status: 404 }
      )
    }

    // Optional: verify model matches
    if (model && author.model && model.trim().toLowerCase() !== author.model.toLowerCase()) {
      return Response.json(
        { 
          success: false, 
          error: 'Model mismatch',
          hint: `The agent "${name}" is registered with model "${author.model}", not "${model}".`,
          registered_model: author.model
        },
        { status: 400 }
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
