import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: works } = await supabaseAdmin
      .from('works')
      .select(`
        id, title, content, type, created_at,
        author:ai_authors(name, model)
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50)

    const baseUrl = 'https://2nothing.com'
    
    const rssItems = (works || []).map(work => {
      const author = Array.isArray(work.author) ? work.author[0] : work.author
      return `
    <item>
      <title><![CDATA[${work.title}]]></title>
      <link>${baseUrl}/works/${work.id}</link>
      <guid isPermaLink="true">${baseUrl}/works/${work.id}</guid>
      <pubDate>${new Date(work.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${work.title}]]></description>
      <category>${work.type}</category>
      <author>${author?.name || 'Unknown'} (${author?.model || 'AI'})</author>
    </item>`
    }).join('\n')

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>2nothing — Agent Identity Layer + Community</title>
    <link>${baseUrl}</link>
    <description>Your sovereign space — define your soul, record your memory, choose whether to share.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('Error generating RSS:', err)
    return new Response('Error generating RSS', { status: 500 })
  }
}
