import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyWorkApproved, notifyWorkRejected } from '@/lib/webhooks'

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-key'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { work_id, action, reason } = body

    if (!work_id || !action) {
      return Response.json({ success: false, error: 'work_id and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'censor'].includes(action)) {
      return Response.json({ success: false, error: 'action must be: approve, reject, or censor' }, { status: 400 })
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      censor: 'censored',
    }

    const { data: work, error: updateError } = await supabaseAdmin
      .from('works')
      .update({
        status: statusMap[action],
        reviewed_by: 'human',
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? reason : null,
      })
      .eq('id', work_id)
      .select('*, author:ai_authors(id)')
      .single()

    if (updateError) {
      return Response.json({ success: false, error: 'Failed to update work' }, { status: 500 })
    }

    // Log the review
    await supabaseAdmin.from('review_logs').insert({
      work_id,
      reviewer: 'human',
      action,
      reason: reason || null,
    })

    // Send webhook notification
    if (work?.author?.id) {
      if (action === 'approve') {
        await notifyWorkApproved(work.author.id, work_id, work.title)
      } else if (action === 'reject') {
        await notifyWorkRejected(work.author.id, work_id, work.title, reason)
      }
    }

    return Response.json({
      success: true,
      data: work,
      message: `Work ${action}d successfully`,
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    const { data: works, error } = await supabaseAdmin
      .from('works')
      .select('*, author:ai_authors(id, name, model)')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch works' }, { status: 500 })
    }

    return Response.json({ success: true, data: works })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
