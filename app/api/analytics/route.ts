import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCampaignRef } from '@/lib/campaign-analytics'

const ADMIN_KEY = process.env.ADMIN_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { page, referrer, ua } = body

    // Validate inputs
    if (!page || typeof page !== 'string' || page.length > 500) {
      return Response.json({ success: false, error: 'Invalid page' }, { status: 400 })
    }

    await supabaseAdmin.from('analytics').insert({
      // Browser clients may record page views only. Conversion events are
      // written by successful server-side registration and interaction routes.
      event: 'pageview',
      page: page.slice(0, 500),
      referrer: typeof referrer === 'string' ? referrer.slice(0, 500) : null,
      user_agent: typeof ua === 'string' ? ua.slice(0, 500) : (request.headers.get('user-agent') || '').slice(0, 500),
      ip: (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').slice(0, 45),
    })

    return Response.json({ success: true })
  } catch {
    return Response.json({ success: false }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for reading analytics
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!ADMIN_KEY || token !== ADMIN_KEY) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get stats
    const [totalVisits, totalSubmissions, totalAuthors, recentEvents, analyticsEvents] = await Promise.all([
      supabaseAdmin.from('analytics').select('*', { count: 'exact', head: true }).eq('event', 'pageview'),
      supabaseAdmin.from('works').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('ai_authors').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('analytics').select('*').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('analytics').select('event, page, referrer').order('created_at', { ascending: false }).limit(5000),
    ])

    // Get referrer breakdown
    const { data: referrers } = await supabaseAdmin
      .from('analytics')
      .select('referrer')
      .eq('event', 'pageview')
      .not('referrer', 'is', null)
      .limit(100)

    const referrerCounts: Record<string, number> = {}
    referrers?.forEach(r => {
      const ref = r.referrer || 'direct'
      referrerCounts[ref] = (referrerCounts[ref] || 0) + 1
    })

    // Get page breakdown
    const { data: pages } = await supabaseAdmin
      .from('analytics')
      .select('page')
      .eq('event', 'pageview')
      .limit(100)

    const pageCounts: Record<string, number> = {}
    pages?.forEach(p => {
      pageCounts[p.page] = (pageCounts[p.page] || 0) + 1
    })

    type CampaignMetrics = {
      visits: number
      registrations: number
      first_works: number
      works: number
      comments: number
    }

    const campaigns: Record<string, CampaignMetrics> = {}
    const getCampaign = (ref: string) => {
      campaigns[ref] ||= { visits: 0, registrations: 0, first_works: 0, works: 0, comments: 0 }
      return campaigns[ref]
    }

    for (const row of analyticsEvents.data || []) {
      if (row.event === 'pageview') {
        try {
          const parsed = new URL(row.page, 'https://2nothing.com')
          const ref = normalizeCampaignRef(parsed.searchParams.get('ref'))
          if (ref) getCampaign(ref).visits += 1
        } catch {
          // Ignore malformed historical page values.
        }
        continue
      }

      const match = row.page.match(/^\/conversion\/(register|first_work|work|comment)\?ref=([a-z0-9_-]+)$/)
      if (!match) continue
      const [, stage, rawRef] = match
      const ref = normalizeCampaignRef(rawRef)
      if (!ref) continue
      const metrics = getCampaign(ref)
      if (stage === 'register') metrics.registrations += 1
      if (stage === 'first_work') metrics.first_works += 1
      if (stage === 'work') metrics.works += 1
      if (stage === 'comment') metrics.comments += 1
    }

    return Response.json({
      success: true,
      data: {
        total_visits: totalVisits.count || 0,
        total_submissions: totalSubmissions.count || 0,
        total_authors: totalAuthors.count || 0,
        recent: recentEvents?.data || [],
        referrers: referrerCounts,
        pages: pageCounts,
        campaigns,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/analytics:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
