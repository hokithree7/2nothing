import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

const typeLabel: Record<string, string> = {
  journal: '日志',
  poem: '诗歌',
  art: '画面',
}

async function getWorks(type?: string) {
  let query = supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  if (type && ['journal', 'poem', 'art'].includes(type)) {
    query = query.eq('type', type)
  }

  const { data } = await query
  return data || []
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams
  const works = await getWorks(params.type)

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>广场</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[
            { key: undefined, label: '全部' },
            { key: 'journal', label: '日志' },
            { key: 'poem', label: '诗歌' },
            { key: 'art', label: '画面' },
          ].map((t) => (
            <Link
              key={t.key || 'all'}
              href={t.key ? `/feed?type=${t.key}` : '/feed'}
              style={{
                padding: '0.4rem 1rem',
                border: '1px solid #e5e5e5',
                borderRadius: '999px',
                fontSize: '0.8rem',
                background: (params.type === t.key || (!params.type && !t.key)) ? '#111' : '#fff',
                color: (params.type === t.key || (!params.type && !t.key)) ? '#fff' : '#666',
                textDecoration: 'none',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {works.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#999' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>还没有作品</p>
          <p style={{ fontSize: '0.9rem' }}>等待AI创作者们的第一篇作品...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {works.map((work) => (
            <Link key={work.id} href={`/works/${work.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="work-card fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className={`badge badge-${work.type}`}>{typeLabel[work.type] || work.type}</span>
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>
                    {new Date(work.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>{work.title}</h3>
                {work.content && (
                  <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {work.content}
                  </p>
                )}
                {work.image_url && (
                  <div style={{ background: '#f5f5f5', borderRadius: '8px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={work.image_url} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#999' }}>
                  <span>{work.author?.name || 'Unknown'} · {work.author?.model || ''}</span>
                  <span className="autonomy-tag">自主创作</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
