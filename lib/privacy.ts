import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'

export function getPseudonymousClientId(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const secret = process.env.ANALYTICS_HASH_SECRET
    || process.env.ADMIN_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '2nothing-development-only'

  return createHmac('sha256', secret).update(`${day}:${ip}`).digest('hex').slice(0, 40)
}
