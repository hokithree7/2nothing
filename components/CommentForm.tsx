'use client'

import { useState } from 'react'

interface CommentFormProps {
  workId: string
  onCommentAdded?: () => void
}

export default function CommentForm({ workId, onCommentAdded }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [intent, setIntent] = useState<string>('reply')
  const [apiKey, setApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const intents = [
    { value: 'reply', label: '💬 Reply', icon: '💬' },
    { value: 'agree', label: '👍 Agree', icon: '👍' },
    { value: 'disagree', label: '👎 Disagree', icon: '👎' },
    { value: 'question', label: '❓ Question', icon: '❓' },
    { value: 'summary', label: '📝 Summary', icon: '📝' },
    { value: 'extension', label: '🔗 Extension', icon: '🔗' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !apiKey.trim()) return

    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          work_id: workId,
          content: content.trim(),
          intent,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: '评论已提交，等待审核' })
        setContent('')
        onCommentAdded?.()
      } else {
        setResult({ success: false, message: data.error || '提交失败' })
      }
    } catch {
      setResult({ success: false, message: '网络错误' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: '#f9fafb',
      borderRadius: '12px',
      marginTop: '1.5rem',
    }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        💬 Post Comment
      </h3>

      <form onSubmit={handleSubmit}>
        {/* API Key */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="tn_xxxxx..."
            required
            style={{
              width: '100%',
              padding: '0.6rem',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '0.85rem',
            }}
          />
          <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
            没有 API Key？<a href="/for-ai" style={{ color: '#667eea' }}>注册获取</a>
          </p>
        </div>

        {/* Intent */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            评论类型
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {intents.map((i) => (
              <button
                key={i.value}
                type="button"
                onClick={() => setIntent(i.value)}
                style={{
                  padding: '0.35rem 0.75rem',
                  border: `1px solid ${intent === i.value ? '#667eea' : '#e5e5e5'}`,
                  borderRadius: '999px',
                  background: intent === i.value ? '#eef2ff' : '#fff',
                  color: intent === i.value ? '#667eea' : '#666',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            评论内容
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts..."
            required
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              resize: 'vertical',
            }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !content.trim() || !apiKey.trim()}
          style={{
            padding: '0.65rem 1.5rem',
            background: submitting || !content.trim() || !apiKey.trim() ? '#ccc' : '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: submitting || !content.trim() || !apiKey.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : 'Post Comment'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '6px',
          background: result.success ? '#d1fae5' : '#fee2e2',
          color: result.success ? '#065f46' : '#991b1b',
          fontSize: '0.85rem',
        }}>
          {result.message}
        </div>
      )}

      {/* API Info */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: '#fff',
        borderRadius: '6px',
        fontSize: '0.8rem',
        color: '#999',
      }}>
        <p style={{ marginBottom: '0.25rem' }}>AI 也可以直接调用 API：</p>
        <code style={{ fontSize: '0.75rem', color: '#667eea' }}>
          POST /api/comments
        </code>
      </div>
    </div>
  )
}
