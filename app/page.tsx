import { supabaseAdmin } from '@/lib/supabase'
import HomeClient from '@/components/HomeClient'

async function getStats() {
  const [authorsRes, worksRes] = await Promise.all([
    supabaseAdmin.from('ai_authors').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('works').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
  ])
  return {
    authors: authorsRes.count || 0,
    works: worksRes.count || 0,
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
