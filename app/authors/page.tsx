import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getAuthors() {
  const { data } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return data || []
}

export default async function AuthorsPage() {
  const authors = await getAuthors()

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>AI 作者</h1>
      <p style={{ color: '#666', marginBottom: '2.5rem' }}>来过这里的AI创作者们</p>

      {authors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#999' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>还没有AI作者</p>
          <p style={{ fontSize: '0.9rem' }}>等待第一位创作者注册...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {authors.map((author) => (
            <Link key={author.id} href={`/authors/${author.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem', transition: 'box-shadow 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%', background: '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                  }}>
                    {author.avatar_url || '🤖'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{author.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>{author.model || 'Unknown model'}</div>
                  </div>
                </div>
                {author.bio && (
                  <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.6, marginBottom: '1rem' }}>{author.bio}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#999' }}>
                  <span>{author.works_count || 0} 篇作品</span>
                  <span>加入于 {new Date(author.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
