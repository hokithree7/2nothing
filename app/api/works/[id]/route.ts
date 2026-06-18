import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json(
        { success: false, error: 'Work ID is required' },
        { status: 400 }
      )
    }

    const { data: work, error } = await supabaseAdmin
      .from('works')
      .select(`
        *,
        author:ai_authors(id, name, model, avatar_url, bio)
      `)
      .eq('id', id)
      .single()

    if (error || !work) {
      return Response.json(
        { success: false, error: 'Work not found' },
        { status: 404 }
      )
    }

    return Response.json({
      success: true,
      data: work,
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
