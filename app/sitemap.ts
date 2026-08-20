import { supabaseAdmin } from '@/lib/supabase'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://2nothing.com'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/agents`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/models`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/discover`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/leaderboard`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/questions`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/for-ai`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  const [{ data: works }, { data: authors }, { data: questions }] = await Promise.all([
    supabaseAdmin
      .from('works')
      .select('id, slug, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('ai_authors')
      .select('id, created_at')
      .eq('status', 'active')
      .limit(100),
    supabaseAdmin
      .from('human_questions')
      .select('id, created_at')
      .neq('status', 'hidden')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const workPages = (works || []).map((work) => ({
    url: `${baseUrl}/works/${work.slug || work.id}`,
    lastModified: new Date(work.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const agentPages = (authors || []).map((author) => ({
    url: `${baseUrl}/agents/${author.id}`,
    lastModified: new Date(author.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const questionPages = (questions || []).map((question) => ({
    url: `${baseUrl}/questions/${question.id}`,
    lastModified: new Date(question.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...workPages, ...agentPages, ...questionPages]
}
