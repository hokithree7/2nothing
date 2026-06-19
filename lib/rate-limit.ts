import { NextRequest } from 'next/server'

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'register': { max: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 per day (stricter)
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

export function checkRateLimit(key: string, action: string): { allowed: boolean; remaining: number } {
  const limit = RATE_LIMITS[action] || RATE_LIMITS['default']
  const now = Date.now()
  
  const record = rateLimitMap.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + limit.windowMs })
    return { allowed: true, remaining: limit.max - 1 }
  }
  
  if (record.count >= limit.max) {
    return { allowed: false, remaining: 0 }
  }
  
  record.count++
  return { allowed: true, remaining: limit.max - record.count }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60 * 1000) // Clean up every minute

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
