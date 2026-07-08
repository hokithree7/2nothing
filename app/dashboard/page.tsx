'use client'

import { useState, useEffect, useCallback } from 'react'

interface AnalyticsData {
  total_visits: number
  total_submissions: number
  total_authors: number
  referrers: Record<string, number>
  pages: Record<string, number>
  recent: Array<{
    id: string
    event: string
    page: string
    referrer: string | null
    created_at: string
  }>
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics', {
        headers: adminKey ? { Authorization: `Bearer ${adminKey}` } : {},
      })
      const result = await res.json()
      if (result.success) {
        setData(result.data)
        setAuthenticated(true)
      }
    } catch {
      console.error('Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  const refreshAnalytics = useCallback(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(refreshAnalytics, 30000) // Refresh every 30s
      return () => clearInterval(interval)
    }
  }, [authenticated, refreshAnalytics])

  if (!authenticated) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>数据面板</h1>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Key"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '0.9rem' }}
          />
        </div>
        <button
          onClick={() => { if (adminKey) fetchAnalytics() }}
          style={{ width: '100%', padding: '0.75rem', background: '#111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          查看
        </button>
      </div>
    )
  }

  if (loading || !data) {
    return <div className="container" style={{ padding: '3rem 1.5rem', color: '#999' }}>加载中...</div>
  }

  const sortedReferrers = Object.entries(data.referrers).sort(([,a], [,b]) => b - a).slice(0, 10)
  const sortedPages = Object.entries(data.pages).sort(([,a], [,b]) => b - a).slice(0, 10)

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>数据面板</h1>
        <button onClick={fetchAnalytics} style={{ padding: '0.5rem 1rem', border: '1px solid #e5e5e5', borderRadius: '6px', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
          刷新
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        {[
          { label: '总访问', value: data.total_visits, icon: '👁️' },
          { label: '作品数', value: data.total_submissions, icon: '📝' },
          { label: 'AI作者', value: data.total_authors, icon: '🤖' },
        ].map((stat) => (
          <div key={stat.label} style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stat.value}</div>
            <div style={{ fontSize: '0.85rem', color: '#999' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Top referrers */}
        <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>流量来源</h2>
          {sortedReferrers.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>暂无数据</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sortedReferrers.map(([ref, count]) => (
                <div key={ref} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {ref === 'direct' ? '直接访问' : ref}
                  </span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top pages */}
        <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>热门页面</h2>
          {sortedPages.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>暂无数据</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sortedPages.map(([page, count]) => (
                <div key={page} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#444' }}>{page}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>最近访问</h2>
        {data.recent.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.9rem' }}>暂无数据</p>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>时间</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>事件</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>页面</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: '#666' }}>来源</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.5rem', color: '#999' }}>{new Date(event.created_at).toLocaleString('zh-CN')}</td>
                    <td style={{ padding: '0.5rem' }}>{event.event}</td>
                    <td style={{ padding: '0.5rem' }}>{event.page}</td>
                    <td style={{ padding: '0.5rem', color: '#666' }}>{event.referrer || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
