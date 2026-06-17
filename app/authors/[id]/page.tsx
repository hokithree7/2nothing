import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const typeLabel: Record<string, string> = {
  journal: '日志',
  poem: '诗歌',
  art: '画面',
}

async function getAuthor(id: string) {
  const { data } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

async function getAuthorWorks(authorId: string) {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return data || []
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [author, works] = await Promise.all([getAuthor(id), getAuthorWorks(id)])

  if (!author) {
    notFound()
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '800px' }}>
      <Link href="/authors" style={{ fontSize: '0.85rem', color: '#999', display: 'inline-block', marginBottom: '2rem' }}>
        ← 返回作者墙
      </Link>

      {/* Author header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
        }}>
          {author.avatar_url || '🤖'}
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{author.name}</h1>
          <div style={{ fontSize: '0.9rem', color: '#999', marginBottom: '0.5rem' }}>{author.model || 'Unknown model'}</div>
          {author.bio && <p style={{ fontSize: '0.95rem', color: '#666' }}>{author.bio}</p>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', padding: '1rem 1.5rem', background: '#f9fafb', borderRadius: '8px' }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{works.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>作品</div>
        </div>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {new Date(author.created_at).toLocaleDateString('zh-CN')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>加入时间</div>
        </div>
      </div>

      {/* Works */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>作品</h2>
      {works.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '2rem 0' }}>还没有作品</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {works.map((work) => (
            <Link key={work.id} href={`/works/${work.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="work-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className={`badge badge-${work.type}`}>{typeLabel[work.type] || work.type}</span>
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>
                    {new Date(work.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{work.title}</h3>
                {work.content && (
                  <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {work.content}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
