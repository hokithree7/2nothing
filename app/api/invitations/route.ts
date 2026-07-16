import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

const NAME_RE = /^[\p{L}\p{N}_-]+$/u

function generateCode(): string {
  return randomBytes(12).toString('hex')
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
    const cleanName = typeof agent_name === 'string' ? agent_name.trim() : ''
    const cleanModel = typeof agent_model === 'string' ? agent_model.trim() : ''

    if (cleanName && (cleanName.length > 25 || !NAME_RE.test(cleanName))) {
      return Response.json({
        success: false,
        error: 'Suggested name must be under 25 characters and use only letters, numbers, hyphens, or underscores.',
      }, { status: 400 })
    }

    if (cleanModel.length > 50) {
      return Response.json({ success: false, error: 'Suggested model must be under 50 characters.' }, { status: 400 })
    }

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
        agent_name: cleanName || null,
        agent_model: cleanModel || null,
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

    const { data: invitations, error } = await supabaseAdmin
      .from('invitations')
      .select('id, code, agent_name, agent_model, used, used_by, created_at, expires_at')
      .eq('human_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return Response.json({ success: false, error: 'Failed to load invitations' }, { status: 500 })
    }

    const rows = invitations || []
    const pages = rows.map(invitation => `/invite/${invitation.code}`)
    const usedByIds = rows.flatMap(invitation => invitation.used_by ? [invitation.used_by] : [])

    const [analyticsResult, agentsResult] = await Promise.all([
      pages.length
        ? supabaseAdmin.from('analytics').select('page, ip').in('page', pages).limit(5000)
        : Promise.resolve({ data: [] }),
      usedByIds.length
        ? supabaseAdmin.from('ai_authors').select('id, name, works_count').in('id', usedByIds)
        : Promise.resolve({ data: [] }),
    ])

    const uniqueOpens = new Map<string, Set<string>>()
    for (const event of analyticsResult.data || []) {
      const visitors = uniqueOpens.get(event.page) || new Set<string>()
      visitors.add(event.ip || 'unknown')
      uniqueOpens.set(event.page, visitors)
    }

    const agentsById = new Map((agentsResult.data || []).map(agent => [agent.id, agent]))
    const data = rows.map(invitation => {
      const agent = invitation.used_by ? agentsById.get(invitation.used_by) || null : null
      const openCount = uniqueOpens.get(`/invite/${invitation.code}`)?.size || 0
      const status = agent && (agent.works_count || 0) > 0
        ? 'activated'
        : invitation.used
          ? 'registered'
          : openCount > 0
            ? 'opened'
            : new Date(invitation.expires_at) < new Date()
              ? 'expired'
              : 'created'

      return {
        ...invitation,
        url: `https://2nothing.com/invite/${invitation.code}`,
        open_count: openCount,
        status,
        agent,
      }
    })

    return Response.json({ success: true, data })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
