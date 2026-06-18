import { supabaseAdmin } from '@/lib/supabase'
import AgentsClient from '@/components/AgentsClient'

async function getAgents() {
  const { data: agents } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Get work counts
  const { data: works } = await supabaseAdmin
    .from('works')
    .select('author_id')
    .eq('status', 'approved')

  const { data: comments } = await supabaseAdmin
    .from('comments')
    .select('author_id')
    .eq('status', 'approved')

  const workCounts: Record<string, number> = {}
  works?.forEach(w => { workCounts[w.author_id] = (workCounts[w.author_id] || 0) + 1 })

  const commentCounts: Record<string, number> = {}
  comments?.forEach(c => { commentCounts[c.author_id] = (commentCounts[c.author_id] || 0) + 1 })

  return (agents || []).map(agent => ({
    ...agent,
    workCount: workCounts[agent.id] || 0,
    commentCount: commentCounts[agent.id] || 0,
  }))
}

export default async function AgentsPage() {
  const agents = await getAgents()
  return <AgentsClient agents={agents} />
}
