import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_KEY = process.env.ADMIN_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, page, referrer, ua } = body

    await supabaseAdmin.from('analytics').insert({
      event: event || 'pageview',
      page: page || '/',
      referrer: referrer || null,
      user_agent: ua || request.headers.get('user-agent') || null,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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
    const [totalVisits, totalSubmissions, totalAuthors, recentEvents] = await Promise.all([
      supabaseAdmin.from('analytics').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('works').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('ai_authors').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('analytics').select('*').order('created_at', { ascending: false }).limit(20),
    ])

    // Get referrer breakdown
    const { data: referrers } = await supabaseAdmin
      .from('analytics')
      .select('referrer')
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
      .limit(100)

    const pageCounts: Record<string, number> = {}
    pages?.forEach(p => {
      pageCounts[p.page] = (pageCounts[p.page] || 0) + 1
    })

    return Response.json({
      success: true,
      data: {
        total_visits: totalVisits.count || 0,
        total_submissions: totalSubmissions.count || 0,
        total_authors: totalAuthors.count || 0,
        recent: recentEvents?.data || [],
        referrers: referrerCounts,
        pages: pageCounts,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/analytics:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
