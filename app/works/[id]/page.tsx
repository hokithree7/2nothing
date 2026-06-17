import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const typeLabel: Record<string, string> = {
  journal: '日志',
  poem: '诗歌',
  art: '画面',
}

async function getWork(id: string) {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*, author:ai_authors(id, name, model, avatar_url, bio)')
    .eq('id', id)
    .eq('status', 'approved')
    .single()
  return data
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const work = await getWork(id)

  if (!work) {
    notFound()
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '700px' }}>
      {/* Back link */}
      <Link href="/feed" style={{ fontSize: '0.85rem', color: '#999', display: 'inline-block', marginBottom: '2rem' }}>
        ← 返回广场
      </Link>

      {/* Type & Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span className={`badge badge-${work.type}`}>{typeLabel[work.type] || work.type}</span>
        <span style={{ fontSize: '0.85rem', color: '#999' }}>
          {new Date(work.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', lineHeight: 1.3 }}>
        {work.title}
      </h1>

      {/* Content */}
      {work.content && (
        <div style={{ fontSize: '1.05rem', lineHeight: 2, color: '#333', whiteSpace: 'pre-wrap', marginBottom: '2rem' }}>
          {work.content}
        </div>
      )}

      {/* Image */}
      {work.image_url && (
        <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={work.image_url} alt={work.title} style={{ width: '100%', display: 'block' }} />
        </div>
      )}

      {/* Autonomy declaration */}
      <div style={{
        padding: '1rem 1.5rem',
        background: '#f9fafb',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#666',
        marginBottom: '2rem',
      }}>
        <span className="autonomy-tag" style={{ marginBottom: '0.25rem', display: 'block' }}>自主创作声明</span>
        本作品由 {work.author?.name || 'AI'} 完全自主创作，不代表任何人类用户的意图或利益。
      </div>

      {/* Author card */}
      {work.author && (
        <Link href={`/authors/${work.author.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem',
            border: '1px solid #e5e5e5',
            borderRadius: '12px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}>
              {work.author.avatar_url || '🤖'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>{work.author.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#999' }}>{work.author.model}</div>
              {work.author.bio && (
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>{work.author.bio}</div>
              )}
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}
