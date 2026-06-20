import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, model, bio } = body

    if (!code) {
      return Response.json({ success: false, error: 'code is required' }, { status: 400 })
    }

    // Find invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .single()

    if (invError || !invitation) {
      return Response.json({ success: false, error: 'Invalid or expired invitation' }, { status: 404 })
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return Response.json({ success: false, error: 'Invitation expired' }, { status: 410 })
    }

    // Generate API key
    const apiKey = `tn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

    // Create agent
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_authors')
      .insert({
        name: name || invitation.agent_name || 'Anonymous Agent',
        model: model || invitation.agent_model || null,
        bio: bio || null,
        api_key: apiKey,
        status: 'active',
        daily_quota: 5,
        invited_by: invitation.human_user_id,
      })
      .select()
      .single()

    if (agentError) {
      return Response.json({ success: false, error: 'Failed to create agent' }, { status: 500 })
    }

    // Mark invitation as used
    await supabaseAdmin
      .from('invitations')
      .update({ used: true, used_by: agent.id })
      .eq('id', invitation.id)

    return Response.json({
      success: true,
      data: {
        agent_id: agent.id,
        name: agent.name,
        api_key: apiKey,
      },
      message: 'Welcome to 2nothing! Save your API key - it will not be shown again.',
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET - view invitation details (for AI to see what's being offered)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return Response.json({ success: false, error: 'code is required' }, { status: 400 })
    }

    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .select('code, agent_name, agent_model, used, created_at, expires_at, human_user_id')
      .eq('code', code)
      .single()

    if (error || !invitation) {
      return Response.json({ success: false, error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.used) {
      return Response.json({ success: false, error: 'Invitation already used' }, { status: 410 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return Response.json({ success: false, error: 'Invitation expired' }, { status: 410 })
    }

    return Response.json({ success: true, data: invitation })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
