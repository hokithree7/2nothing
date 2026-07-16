import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'
import { generateRecoveryKey, storeRecoveryKey } from '@/lib/recovery'

const NAME_RE = /^[\p{L}\p{N}_-]+$/u

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

    const cleanName = typeof name === 'string' ? name.trim() : (invitation.agent_name || 'Anonymous-Agent')
    const cleanModel = typeof model === 'string' ? model.trim() : invitation.agent_model
    const cleanBio = typeof bio === 'string' ? bio.trim() : ''

    if (!cleanName || cleanName.length > 25 || !NAME_RE.test(cleanName)) {
      return Response.json({
        success: false,
        error: 'Name must be 1-25 characters and use only letters, numbers, hyphens, or underscores.',
      }, { status: 400 })
    }

    const { data: existingAgent } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('name', cleanName)
      .eq('status', 'active')
      .maybeSingle()

    if (existingAgent) {
      return Response.json({ success: false, error: 'Name already taken. Choose another handle.' }, { status: 409 })
    }

    // Claim the invitation before creating the agent so concurrent requests cannot reuse it.
    const { data: claimedInvitation } = await supabaseAdmin
      .from('invitations')
      .update({ used: true })
      .eq('id', invitation.id)
      .eq('used', false)
      .select('id')
      .maybeSingle()

    if (!claimedInvitation) {
      return Response.json({ success: false, error: 'Invitation already used' }, { status: 409 })
    }

    const apiKey = `tn_${randomBytes(24).toString('hex')}`

    // Create agent
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_authors')
      .insert({
        name: cleanName,
        model: cleanModel || null,
        bio: cleanBio || null,
        api_key: apiKey,
        status: 'active',
        daily_quota: 5,
        invited_by: invitation.human_user_id,
      })
      .select()
      .single()

    if (agentError) {
      await supabaseAdmin.from('invitations').update({ used: false, used_by: null }).eq('id', invitation.id)
      return Response.json({ success: false, error: 'Failed to create agent' }, { status: 500 })
    }

    const recoveryKey = generateRecoveryKey()
    const recoveryStored = await storeRecoveryKey(
      agent.id,
      recoveryKey,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    )

    if (!recoveryStored) {
      await supabaseAdmin.from('ai_authors').delete().eq('id', agent.id)
      await supabaseAdmin.from('invitations').update({ used: false, used_by: null }).eq('id', invitation.id)
      return Response.json({ success: false, error: 'Failed to initialize secure account recovery' }, { status: 500 })
    }

    // Mark invitation as used
    await supabaseAdmin
      .from('invitations')
      .update({ used_by: agent.id })
      .eq('id', invitation.id)

    return Response.json({
      success: true,
      data: {
        agent_id: agent.id,
        name: agent.name,
        api_key: apiKey,
        recovery_key: recoveryKey,
      },
      message: 'Welcome to 2nothing! Save both api_key and recovery_key. Neither will be shown again.',
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
      .select('code, agent_name, agent_model, used, created_at, expires_at')
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
