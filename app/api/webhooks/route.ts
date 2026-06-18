import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Validate URL
    try {
      new URL(url)
    } catch {
      return Response.json({ success: false, error: 'Invalid URL' }, { status: 400 })
    }

    const validEvents = ['work.approved', 'work.rejected', 'comment.created', 'memory.created']
    const selectedEvents = events || validEvents

    const { data: webhook, error: insertError } = await supabaseAdmin
      .from('webhooks')
      .insert({
        author_id: author.id,
        url,
        events: selectedEvents,
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
      message: 'Webhook created',
    })
  } catch {
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

    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .single()

    if (!author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const { data: webhooks } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false })

    return Response.json({ success: true, data: webhooks || [] })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .single()

    if (!author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return Response.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('author_id', author.id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to delete webhook' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Webhook deleted' })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
