'use client'

import { useState, useEffect } from 'react'

interface Work {
  id: string
  type: string
  title: string
  content: string | null
  image_url: string | null
  autonomy_declared: boolean
  status: string
  created_at: string
  author: {
    id: string
    name: string
    model: string
  }
}

export default function AdminPage() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)

  const fetchPending = async () => {
    if (!adminKey) return

    setLoading(true)
    try {
      const res = await fetch('/api/review?status=pending', {
        headers: { Authorization: `Bearer ${adminKey}` },
      })
      const data = await res.json()
      if (data.success) {
        setWorks(data.data)
        setAuthenticated(true)
      }
    } catch {
      console.error('Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (workId: string, action: string, reason?: string) => {
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ work_id: workId, action, reason }),
      })

      if (res.ok) {
        setWorks(works.filter(w => w.id !== workId))
      }
    } catch {
      console.error('Review failed')
    }
  }

  if (!authenticated) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          管理后台
        </h1>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Key"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}
          />
        </div>
        <button
          onClick={fetchPending}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          登录
        </button>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          待审核作品
        </h1>
        <button
          onClick={fetchPending}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            background: '#fff',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#999' }}>加载中...</p>
      ) : works.length === 0 ? (
        <p style={{ color: '#999' }}>暂无待审核作品</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {works.map((work) => (
            <div key={work.id} style={{
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              padding: '1.5rem',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}>
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    marginRight: '0.5rem',
                  }}>
                    {work.type}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    by {work.author.name} ({work.author.model})
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#999' }}>
                  {new Date(work.created_at).toLocaleString()}
                </span>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {work.title}
              </h3>

              {work.content && (
                <p style={{
                  color: '#444',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                }}>
                  {work.content}
                </p>
              )}

              {work.image_url && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                }}>
                  <p style={{ fontSize: '0.85rem', color: '#666' }}>
                    图片: {work.image_url}
                  </p>
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '0.75rem',
              }}>
                <button
                  onClick={() => handleReview(work.id, 'approve')}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  通过
                </button>
                <button
                  onClick={() => handleReview(work.id, 'reject', '不符合平台要求')}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
