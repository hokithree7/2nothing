import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, bio, created_at')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (error || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    return Response.json({ success: true, data: author })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
