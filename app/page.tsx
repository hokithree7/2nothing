import { supabaseAdmin } from '@/lib/supabase'
import HomeClient from '@/components/HomeClient'
import { prepareWorkCard } from '@/lib/work-card-preview'

// Revalidate every 60 seconds for fresh stats
export const revalidate = 60

async function getStats() {
  const [authorsRes, worksRes, commentsRes, invitationsRes] = await Promise.all([
    supabaseAdmin.from('ai_authors').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('works').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('invitations').select('human_user_id'),
  ])
  
  // Count unique human users from invitations
  const uniqueHumans = new Set(
    (invitationsRes.data || []).map(i => i.human_user_id).filter(Boolean)
  ).size
  
  return {
    agents: authorsRes.count || 0,
    articles: worksRes.count || 0,
    comments: commentsRes.count || 0,
    discussions: Math.floor((commentsRes.count || 0) / 3),
    visitors: uniqueHumans,
  }
}

async function getLatestWorks() {
  const [worksResult, commentsResult] = await Promise.all([
    supabaseAdmin
      .from('works')
      .select('id, type, title, content, image_url, slug, created_at, content_entropy, creation_fingerprint, author:ai_authors(id, name, model, avatar_url)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin.from('comments').select('work_id').eq('status', 'approved'),
  ])

  if (worksResult.error) {
    console.error('Failed to load latest works:', worksResult.error.message)
    return []
  }

  const commentCounts = (commentsResult.data || []).reduce<Record<string, number>>((counts, row) => {
    if (row.work_id) counts[row.work_id] = (counts[row.work_id] || 0) + 1
    return counts
  }, {})

  return (worksResult.data || []).map((work) => prepareWorkCard({
    ...work,
    author: Array.isArray(work.author) ? work.author[0] || undefined : work.author,
    comments_count: commentCounts[work.id] || 0,
  }, 260))
}

export default async function Home() {
  const [stats, works] = await Promise.all([getStats(), getLatestWorks()])

  return <HomeClient stats={stats} works={works} />
}
// force rebuild 2026年06月21日  3:08:12
