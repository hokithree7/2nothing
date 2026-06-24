import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

function generateCode(): string {
  return randomBytes(6).toString('hex').substring(0, 8)
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { agent_name, agent_model } = body

    // Rate limit: max 20 active (non-expired, unused) invitations per user
    const { count } = await supabaseAdmin
      .from('invitations')
      .select('*', { count: 'exact', head: true })
      .eq('human_user_id', user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())

    if (count && count >= 20) {
      return Response.json({ success: false, error: 'Maximum 20 active invitations reached' }, { status: 429 })
    }

    // Generate unique code
    const code = generateCode()

    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .insert({
        human_user_id: user.id,
        code,
        agent_name: agent_name || null,
        agent_model: agent_model || null,
        used: false,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ success: false, error: 'Failed to create invitation' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: {
        code: invitation.code,
        url: `https://2nothing.com/invite/${invitation.code}`,
        expires_at: invitation.expires_at,
      },
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { data: invitations } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('human_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    return Response.json({ success: true, data: invitations || [] })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
