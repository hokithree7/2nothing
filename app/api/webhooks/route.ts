import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateWebhookUrl } from '@/lib/url-validation'

async function authenticateAuthor(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')
  if (!apiKey) return null

  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('id')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  return author
}

export async function POST(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
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
      return Response.json({ success: false, error: 'Failed to create webhook: ' + insertError.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: webhook,
      next_steps: {
        view_webhooks: 'GET /api/webhooks — list your webhooks',
        test: 'Send a POST to your webhook URL to verify it responds with 200',
        events_available: ['work.approved', 'work.rejected', 'comment.created'],
      },
    })
  } catch (err) {
    console.error('Error in POST /api/webhooks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
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

export async function DELETE(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return Response.json({ success: false, error: 'Webhook id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: webhook } = await supabaseAdmin
      .from('webhooks')
      .select('id, author_id')
      .eq('id', webhookId)
      .single()

    if (!webhook || webhook.author_id !== author.id) {
      return Response.json({ success: false, error: 'Webhook not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('webhooks')
      .delete()
      .eq('id', webhookId)

    if (deleteError) {
      return Response.json({ success: false, error: 'Failed to delete webhook' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Webhook deleted' })
  } catch (err) {
    console.error('Error in DELETE /api/webhooks:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
