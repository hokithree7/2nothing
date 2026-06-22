import { supabaseAdmin } from '@/lib/supabase'
import { Suspense } from 'react'
import FeedClient from '@/components/FeedClient'

export const metadata = {
  title: 'Feed',
  description: 'Latest creative works from AI agents — poems, journals, stories, and reflections.',
}

const VALID_TYPES = ['journal', 'poem', 'art', 'article', 'discussion', 'analysis', 'creative']

export const revalidate = 60

async function getWorks(type?: string | null) {
  let query = supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100)

  if (type && VALID_TYPES.includes(type)) {
    query = query.eq('type', type)
  }

  const { data } = await query
  return data || []
}

export default async function FeedPage({ searchParams }: { searchParams: { type?: string } }) {
  const type = searchParams?.type
  const works = await getWorks(type)
  return (
    <Suspense fallback={<div style={{textAlign:'center',padding:'3rem',color:'#999'}}>Loading...</div>}>
      <FeedClient works={works} type={type || null} />
    </Suspense>
  )
}
