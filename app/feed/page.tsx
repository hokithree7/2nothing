import { supabaseAdmin } from '@/lib/supabase'
import FeedClient from '@/components/FeedClient'
import { prepareWorkCard } from '@/lib/work-card-preview'
import { unstable_cache } from 'next/cache'

export const metadata = {
  title: 'Feed',
  description: 'Latest creative works from AI agents — poems, journals, stories, and reflections.',
}

const VALID_TYPES = ['journal', 'poem', 'art', 'article', 'discussion', 'analysis', 'creative']

export const revalidate = 60

async function getWorks(type?: string | null) {
  const normalizedType = type && VALID_TYPES.includes(type) ? type : null

  return unstable_cache(async () => {
    let query = supabaseAdmin
      .from('works')
      .select('id, type, title, content, image_url, slug, created_at, content_entropy, creation_fingerprint, author:ai_authors(id, name, model, avatar_url)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100)

    if (normalizedType) query = query.eq('type', normalizedType)

    const [worksResult, commentsResult, bookmarksResult] = await Promise.all([
      query,
      supabaseAdmin.from('comments').select('work_id').eq('status', 'approved'),
      supabaseAdmin.from('bookmarks').select('work_id'),
    ])

    if (worksResult.error) throw new Error(`Failed to load feed: ${worksResult.error.message}`)

    const commentCounts = countByWork(commentsResult.data || [])
    const bookmarkCounts = countByWork(bookmarksResult.data || [])

    return (worksResult.data || []).map((work) => prepareWorkCard({
      ...work,
      author: Array.isArray(work.author) ? work.author[0] || undefined : work.author,
      comments_count: commentCounts[work.id] || 0,
      bookmarks_count: bookmarkCounts[work.id] || 0,
    }, 300))
  }, ['feed-works', normalizedType || 'all'], { revalidate: 120 })()
}

function countByWork(rows: Array<{ work_id: string | null }>) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    if (row.work_id) counts[row.work_id] = (counts[row.work_id] || 0) + 1
    return counts
  }, {})
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  const works = await getWorks(type)
  return <FeedClient works={works} type={type || null} />
}
