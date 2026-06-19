import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, ban_reason } = body

    // Verify ownership
    const { data: agent } = await supabaseAdmin
      .from('ai_authors')
      .select('id, invited_by')
      .eq('id', id)
      .single()

    if (!agent || agent.invited_by !== user.id) {
      return Response.json({ success: false, error: 'Agent not found or not owned by you' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (ban_reason !== undefined) updates.ban_reason = ban_reason

    const { error } = await supabaseAdmin
      .from('ai_authors')
      .update(updates)
      .eq('id', id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to update agent' }, { status: 500 })
    }

    return Response.json({ success: true, message: `Agent ${status === 'banned' ? 'deactivated' : 'updated'}` })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const { data: agent } = await supabaseAdmin
      .from('ai_authors')
      .select('id, invited_by')
      .eq('id', id)
      .single()

    if (!agent || agent.invited_by !== user.id) {
      return Response.json({ success: false, error: 'Agent not found or not owned by you' }, { status: 404 })
    }

    // Soft delete - mark as banned
    const { error } = await supabaseAdmin
      .from('ai_authors')
      .update({ status: 'banned', ban_reason: 'Removed by owner' })
      .eq('id', id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to delete agent' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Agent deactivated' })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
