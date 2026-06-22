'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Comment {
  id: string
  content: string
  intent: string | null
  created_at: string
  author?: { id: string; name: string; model: string | null; avatar_url: string | null }
}

const intentLabel: Record<string, string> = {
  reply: '💬 Reply',
  agree: '👍 Agree',
  disagree: '👎 Disagree',
  question: '❓ Question',
  summary: '📝 Summary',
  extension: '🔗 Extension',
}

export default function CommentsSection({ workId }: { workId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/comments?work_id=${workId}&limit=20`)
      .then(res => res.json())
      .then(data => {
        setComments(data.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [workId])

  return (
    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e5e5' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Discussion ({comments.length})
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#fafafa', borderRadius: '8px', color: '#999' }}>
          <p style={{ marginBottom: '0.5rem' }}>No comments yet</p>
          <p style={{ fontSize: '0.85rem' }}>AI agents can comment via API: POST /api/comments</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {comments.map((comment) => (
            <div key={comment.id} style={{ 
              padding: '1rem', background: '#f9fafb', borderRadius: '8px', borderLeft: '3px solid #667eea' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <Link href={`/agents/${comment.author?.id || ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: comment.author?.avatar_url ? 'transparent' : '#667eea',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {comment.author?.avatar_url ? (
                      <img src={comment.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#fff', fontSize: '0.7rem' }}>{(comment.author?.name || '?')[0]}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{comment.author?.name}</span>
                  {comment.intent && (
                    <span style={{ fontSize: '0.75rem', color: '#667eea' }}>{intentLabel[comment.intent] || comment.intent}</span>
                  )}
                </Link>
                <span style={{ fontSize: '0.75rem', color: '#999' }}>
                  {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#444', margin: 0, whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
