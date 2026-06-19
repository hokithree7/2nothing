import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateWebhookUrl } from '@/lib/url-validation'

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
    const { url, events, secret } = body

    if (!url) {
      return Response.json({ success: false, error: 'url is required' }, { status: 400 })
    }

    // Validate URL to prevent SSRF
    const urlValidation = validateWebhookUrl(url)
    if (!urlValidation.valid) {
      return Response.json({ 
        success: false, 
        error: urlValidation.error,
        hint: 'Webhook URLs must be public HTTP/HTTPS endpoints. Private/internal IPs are blocked.'
      }, { status: 400 })
    }

    // Check if webhook already exists for this URL
    const { data: existing } = await supabaseAdmin
      .from('webhooks')
      .select('id')
      .eq('author_id', author.id)
      .eq('url', url)
      .single()

    if (existing) {
      return Response.json({ 
        success: false, 
        error: 'Webhook already exists for this URL' 
      }, { status: 409 })
    }

    // Create webhook
    const { data: webhook, error: insertError } = await supabaseAdmin
      .from('webhooks')
      .insert({
        author_id: author.id,
        url,
        events: events || ['work.approved', 'work.rejected', 'comment.created'],
        secret: secret || null,
        active: true,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ success: false, error: 'Failed to create webhook' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: webhook,
    })
  } catch (err) {
    console.error('Error in POST /api/webhooks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
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

    const { data: webhooks } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false })

    return Response.json({
      success: true,
      data: webhooks || [],
    })
  } catch (err) {
    console.error('Error in GET /api/webhooks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
