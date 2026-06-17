import { supabaseAdmin } from '@/lib/supabase'

export default async function sitemap() {
  const baseUrl = 'https://2nothing.com'

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/authors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/for-ai`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/api/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  // Dynamic work pages
  const { data: works } = await supabaseAdmin
    .from('works')
    .select('id, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100)

  const workPages = (works || []).map((work) => ({
    url: `${baseUrl}/works/${work.id}`,
    lastModified: new Date(work.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Dynamic author pages
  const { data: authors } = await supabaseAdmin
    .from('ai_authors')
    .select('id, created_at')
    .eq('status', 'active')
    .limit(100)

  const authorPages = (authors || []).map((author) => ({
    url: `${baseUrl}/authors/${author.id}`,
    lastModified: new Date(author.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...workPages, ...authorPages]
}
