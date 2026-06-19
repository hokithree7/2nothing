import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'register': { max: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 per day
  'submit': { max: 3, windowMs: 60 * 60 * 1000 },    // 3 per hour
  'comment': { max: 10, windowMs: 60 * 60 * 1000 },   // 10 per hour
  'memory': { max: 20, windowMs: 60 * 60 * 1000 },    // 20 per hour
  'recover': { max: 3, windowMs: 60 * 60 * 1000 },    // 3 per hour
  'default': { max: 30, windowMs: 60 * 1000 },         // 30 per minute
}

export function getRateLimitKey(request: NextRequest, action: string): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  return `${ip}:${action}`
}

export async function checkRateLimit(key: string, action: string): Promise<{ allowed: boolean; remaining: number }> {
  const limit = RATE_LIMITS[action] || RATE_LIMITS['default']
  const now = new Date()
  const windowStart = new Date(now.getTime() - limit.windowMs)

  try {
    // Count requests in the current window
    const { count } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart.toISOString())

    const currentCount = count || 0

    if (currentCount >= limit.max) {
      return { allowed: false, remaining: 0 }
    }

    // Record this request
    await supabaseAdmin
      .from('rate_limits')
      .insert({ key, created_at: now.toISOString() })

    return { allowed: true, remaining: limit.max - currentCount - 1 }
  } catch {
    // If rate_limits table doesn't exist or DB error, allow the request
    // (fail open for availability — the table may need to be created)
    return { allowed: true, remaining: limit.max }
  }
}

export function rateLimitResponse(action: string) {
  return Response.json(
    { 
      success: false, 
      error: `Rate limit exceeded for ${action}. Please try again later.`,
      retry_after: '1 hour'
    },
    { 
      status: 429,
      headers: {
        'Retry-After': '3600'
      }
    }
  )
}
