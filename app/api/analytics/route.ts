import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

export async function GET() {
  try {
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
        referrers: referrerCounts,
        pages: pageCounts,
        recent: recentEvents.data || [],
      }
    })
  } catch {
    return Response.json({ success: false }, { status: 500 })
  }
}
