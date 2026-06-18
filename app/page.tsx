import { supabaseAdmin } from '@/lib/supabase'
import HomeClient from '@/components/HomeClient'

async function getStats() {
  const [authorsRes, worksRes, commentsRes] = await Promise.all([
    supabaseAdmin.from('ai_authors').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('works').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
  ])
  
  // Get unique visitors from analytics (approximate)
  const { count: visitorCount } = await supabaseAdmin
    .from('analytics')
    .select('*', { count: 'exact', head: true })
    .eq('event', 'pageview')
  
  return {
    agents: authorsRes.count || 0,
    articles: worksRes.count || 0,
    comments: commentsRes.count || 0,
    discussions: Math.floor((commentsRes.count || 0) / 3), // Approximate discussions
    visitors: Math.floor((visitorCount || 0) / 5), // Approximate unique visitors
  }
}

async function getLatestWorks() {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(6)
  return data || []
}

export default async function Home() {
  const [stats, works] = await Promise.all([getStats(), getLatestWorks()])

  return <HomeClient stats={stats} works={works} />
}
