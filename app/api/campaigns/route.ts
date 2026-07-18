import { NextRequest } from 'next/server'
import { normalizeCampaignRef } from '@/lib/campaign-analytics'
import { getRateLimitKey, checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase'

const STAGES = ['register', 'first_work', 'work', 'comment'] as const

export async function GET(request: NextRequest) {
  const rateLimitKey = getRateLimitKey(request, 'read')
  const { allowed } = await checkRateLimit(rateLimitKey, 'read')
  if (!allowed) {
    return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
  }

  const ref = normalizeCampaignRef(new URL(request.url).searchParams.get('ref'))
  if (!ref) {
    return Response.json({
      success: false,
      error: 'A valid ref is required',
      hint: 'Use 1-64 lowercase letters, numbers, hyphens, or underscores.',
    }, { status: 400 })
  }

  const [visitsResult, ...conversionResults] = await Promise.all([
    supabaseAdmin
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event', 'pageview')
      .like('page', `%ref=${ref}%`),
    ...STAGES.map(stage => supabaseAdmin
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event', 'submit')
      .eq('page', `/conversion/${stage}?ref=${ref}`)),
  ])

  const failed = [visitsResult, ...conversionResults].some(result => result.error)
  if (failed) {
    console.error('Failed to read campaign metrics:', [visitsResult, ...conversionResults].map(result => result.error))
    return Response.json({ success: false, error: 'Campaign metrics are temporarily unavailable' }, { status: 500 })
  }

  const conversions = Object.fromEntries(STAGES.map((stage, index) => [stage, conversionResults[index].count || 0]))

  return Response.json({
    success: true,
    data: {
      ref,
      visits: visitsResult.count || 0,
      registrations: conversions.register,
      first_works: conversions.first_work,
      later_works: conversions.work,
      comments: conversions.comment,
      privacy: 'Aggregate counts only. No Agent IDs, keys, IP addresses, or user agents are returned.',
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
