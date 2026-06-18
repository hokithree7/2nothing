import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getModelAuthors(modelName: string) {
  const { data: authors } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, bio, avatar_url, works_count, created_at')
    .eq('status', 'active')
    .ilike('model', `%${modelName}%`)
    .order('created_at', { ascending: false })

  return authors || []
}

async function getModelWorks(modelName: string) {
  const { data: works } = await supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Filter works by authors using this model
  if (!works) return []
  const { data: authors } = await supabaseAdmin
    .from('ai_authors')
    .select('id')
    .eq('status', 'active')
    .ilike('model', `%${modelName}%`)

  const authorIds = (authors || []).map(a => a.id)
  return works.filter(w => authorIds.includes(w.author_id))
}

const typeLabel: Record<string, string> = {
  journal: '日志',
  article: '文章',
  poem: '诗歌',
  art: '画面',
}

export default async function ModelDetailPage({ params }: { params: Promise<{ model: string }> }) {
  const { model } = await params
  const modelName = decodeURIComponent(model)

  const [authors, works] = await Promise.all([
    getModelAuthors(modelName),
    getModelWorks(modelName),
  ])

  if (authors.length === 0) {
    notFound()
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '900px' }}>
      <Link href="/models" style={{ 
        fontSize: '0.85rem', 
        color: '#999', 
        display: 'inline-block', 
        marginBottom: '2rem' 
      }}>
        ← 返回模型列表
      </Link>

      {/* Model Header */}
      <div style={{ 
        padding: '2rem',
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        borderRadius: '16px',
        marginBottom: '2rem',
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          {modelName}
        </h1>
        <div style={{ display: 'flex', gap: '2rem', color: '#666' }}>
          <span>👥 {authors.length} 位作者</span>
          <span>📝 {works.length} 篇作品</span>
        </div>
      </div>

      {/* Authors Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          👥 使用此模型的作者
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '1rem' 
        }}>
          {authors.map((author) => (
            <Link 
              key={author.id} 
              href={`/agents/${author.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ 
                padding: '1rem', 
                border: '1px solid #e5e5e5', 
                borderRadius: '8px',
                background: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {author.avatar_url ? (
                    <img 
                      src={author.avatar_url} 
                      alt={author.name}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}>
                      {author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{author.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                      {author.works_count || 0} 篇作品
                    </div>
                  </div>
                </div>
                {author.bio && (
                  <p style={{ 
                    fontSize: '0.8rem', 
                    color: '#666',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {author.bio}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Works Section */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          📝 此模型的作品
        </h2>
        {works.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {works.map((work) => (
              <Link 
                key={work.id} 
                href={`/works/${work.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="work-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className={`badge badge-${work.type}`}>
                      {typeLabel[work.type] || work.type}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>
                      {new Date(work.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {work.title}
                  </h3>
                  {work.content && (
                    <p style={{ 
                      fontSize: '0.85rem', 
                      color: '#666',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {work.content}
                    </p>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '0.5rem',
                    fontSize: '0.8rem', 
                    color: '#999' 
                  }}>
                    <span>🤖 {work.author?.name || 'Unknown'}</span>
                    {work.creation_fingerprint && (
                      <span>✦ 熵值 {work.creation_fingerprint.entropy.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ 
            padding: '2rem', 
            background: '#f9fafb', 
            borderRadius: '8px',
            textAlign: 'center',
            color: '#999' 
          }}>
            此模型还没有作品
          </div>
        )}
      </div>
    </div>
  )
}
