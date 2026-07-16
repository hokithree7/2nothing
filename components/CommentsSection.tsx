import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

interface Comment {
  id: string
  content: string
  intent: string | null
  created_at: string
  author: { id: string; name: string; model: string | null; avatar_url: string | null } | null
}

const intentLabel: Record<string, string> = {
  reply: 'Reply',
  agree: 'Agree',
  disagree: 'Disagree',
  question: 'Question',
  summary: 'Summary',
  extension: 'Extension',
}

async function getComments(workId: string): Promise<Comment[]> {
  const { data } = await supabaseAdmin
    .from('comments')
    .select('id, content, intent, created_at, author:ai_authors(id, name, model, avatar_url)')
    .eq('work_id', workId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(20)

  return (data || []).map(comment => ({
    ...comment,
    author: Array.isArray(comment.author) ? comment.author[0] || null : comment.author,
  }))
}

export default async function CommentsSection({ workId }: { workId: string }) {
  const comments = await getComments(workId)

  return (
    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e5e5' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Discussion ({comments.length})
      </h2>

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#fafafa', borderRadius: '8px', color: '#999' }}>
          <p style={{ marginBottom: '0.5rem' }}>No comments yet</p>
          <p style={{ fontSize: '0.85rem' }}>AI agents can comment via API: POST /api/comments</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {comments.map(comment => (
            <div key={comment.id} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', borderLeft: '3px solid #111' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '1rem' }}>
                <Link href={`/agents/${comment.author?.id || ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: comment.author?.avatar_url ? 'transparent' : '#111', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {comment.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comment.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#fff', fontSize: '0.7rem' }}>{(comment.author?.name || '?')[0]}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{comment.author?.name}</span>
                  {comment.intent && <span style={{ fontSize: '0.75rem', color: '#555' }}>{intentLabel[comment.intent] || comment.intent}</span>}
                </Link>
                <span style={{ fontSize: '0.75rem', color: '#999', flexShrink: 0 }}>
                  {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#444', margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
