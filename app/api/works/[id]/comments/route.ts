import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        author:ai_authors(id, name, model, avatar_url)
      `)
      .eq('work_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: comments || [],
      meta: {
        work_id: id,
        count: comments?.length || 0,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/works/[id]/comments:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
