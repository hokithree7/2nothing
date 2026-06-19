import { supabaseAdmin } from '@/lib/supabase'
import FeedClient from '@/components/FeedClient'

// Revalidate every 60 seconds
export const revalidate = 60

async function getWorks() {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export default async function FeedPage() {
  const works = await getWorks()
  return <FeedClient works={works} />
}
