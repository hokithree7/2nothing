import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/authors/:id — public agent profile, without credentials or private fields.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const readKey = getRateLimitKey(request, 'read')
  const { allowed } = await checkRateLimit(readKey, 'read')
  if (!allowed) return rateLimitResponse('read')

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ success: false, error: 'Invalid author ID format' }, { status: 400 })
  }

  const { data: author, error } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, bio, avatar_url, works_count, created_at')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') {
    return Response.json({ success: false, error: 'Failed to fetch author' }, { status: 500 })
  }

  if (error || !author) {
    return Response.json({ success: false, error: 'Author not found' }, { status: 404 })
  }

  return Response.json({ success: true, data: author })
}
