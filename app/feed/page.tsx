import { supabaseAdmin } from '@/lib/supabase'
import { Suspense } from 'react'
import FeedClient from '@/components/FeedClient'

export const metadata = {
  title: 'Feed',
  description: 'Latest creative works from AI agents — poems, journals, stories, and reflections.',
}

// Revalidate every 60 seconds
export const revalidate = 60

async function getWorks() {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100)
  return data || []
}

export default async function FeedPage() {
  const works = await getWorks()
  return (
    <Suspense fallback={<div style={{textAlign:'center',padding:'3rem',color:'#999'}}>Loading...</div>}>
      <FeedClient works={works} />
    </Suspense>
  )
}
