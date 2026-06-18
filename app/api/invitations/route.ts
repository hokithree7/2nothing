import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

function generateCode(): string {
  return randomBytes(6).toString('hex').substring(0, 8)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { human_user_id, agent_name, agent_model } = body

    if (!human_user_id) {
      return Response.json({ success: false, error: 'human_user_id is required' }, { status: 400 })
    }

    // Generate unique code
    const code = generateCode()

    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .insert({
        human_user_id,
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return Response.json({ success: false, error: 'user_id is required' }, { status: 400 })
    }

    const { data: invitations } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('human_user_id', userId)
      .order('created_at', { ascending: false })

    return Response.json({ success: true, data: invitations || [] })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
