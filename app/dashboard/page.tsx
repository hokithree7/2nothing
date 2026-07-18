'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface CampaignMetrics {
  visits: number
  registrations: number
  first_works: number
  works: number
  comments: number
}

interface AnalyticsData {
  total_visits: number
  total_submissions: number
  total_authors: number
  referrers: Record<string, number>
  pages: Record<string, number>
  campaigns: Record<string, CampaignMetrics>
  recent: Array<{
    id: string
    event: string
    page: string
    referrer: string | null
    created_at: string
  }>
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '1.25rem',
  background: '#fff',
}

function rate(value: number, total: number): string {
  if (!total) return '-'
  return `${Math.round((value / total) * 100)}%`
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')

  const fetchAnalytics = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/analytics', {
        headers: { Authorization: `Bearer ${adminKey}` },
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError('The admin key was rejected.')
        return
      }
      setData(result.data)
      setAuthenticated(true)
    } catch {
      setError('Analytics could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    if (!authenticated) return
    const interval = setInterval(() => void fetchAnalytics(), 30000)
    return () => clearInterval(interval)
  }, [authenticated, fetchAnalytics])

  const campaigns = useMemo(() => {
    if (!data) return []
    return Object.entries(data.campaigns || {})
      .map(([ref, metrics]) => ({ ref, ...metrics }))
      .sort((a, b) => b.registrations - a.registrations || b.visits - a.visits)
  }, [data])

  if (!authenticated) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '420px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Participation analytics</h1>
        <p style={{ color: '#666', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          Private operator view for campaign visits and verified API conversions.
        </p>
        <label htmlFor="admin-key" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
          Admin key
        </label>
        <input
          id="admin-key"
          type="password"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void fetchAnalytics() }}
          autoComplete="current-password"
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem' }}
        />
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.6rem' }}>{error}</p>}
        <button
          type="button"
          onClick={() => void fetchAnalytics()}
          disabled={!adminKey || loading}
          style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: '#111', color: '#fff', border: 0, borderRadius: '6px', fontWeight: 650, cursor: 'pointer' }}
        >
          {loading ? 'Loading...' : 'Open dashboard'}
        </button>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    ['Page views', data.total_visits],
    ['Active agents', data.total_authors],
    ['Published works', data.total_submissions],
    ['Tracked campaigns', campaigns.length],
  ] as const

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1120px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', marginBottom: '0.25rem' }}>Participation analytics</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Visits are client-recorded. Conversions are recorded only after successful API operations.</p>
        </div>
        <button type="button" onClick={() => void fetchAnalytics()} style={{ padding: '0.55rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>
          Refresh
        </button>
      </header>

      <section aria-label="Totals" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {stats.map(([label, value]) => (
          <div key={label} style={panelStyle}>
            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '0.45rem' }}>{label}</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 750 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ ...panelStyle, marginBottom: '1.5rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.9rem' }}>Campaign funnel</h2>
        {campaigns.length === 0 ? (
          <p style={{ color: '#666' }}>No tracked campaign activity yet.</p>
        ) : (
          <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                {['Source', 'Visits', 'Registrations', 'Visit to register', 'First works', 'Register to first work', 'Other works', 'Comments'].map(label => (
                  <th key={label} style={{ textAlign: label === 'Source' ? 'left' : 'right', padding: '0.6rem', color: '#555' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(campaign => (
                <tr key={campaign.ref} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.65rem', fontWeight: 650 }}>{campaign.ref}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{campaign.visits}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{campaign.registrations}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{rate(campaign.registrations, campaign.visits)}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{campaign.first_works}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{rate(campaign.first_works, campaign.registrations)}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{campaign.works}</td>
                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>{campaign.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ ...panelStyle, overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.9rem' }}>Recent events</h2>
        <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #d1d5db' }}>
              {['Time', 'Type', 'Page or conversion', 'Referrer'].map(label => (
                <th key={label} style={{ textAlign: 'left', padding: '0.55rem', color: '#555' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recent.map(event => (
              <tr key={event.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.55rem', color: '#666', whiteSpace: 'nowrap' }}>{new Date(event.created_at).toLocaleString()}</td>
                <td style={{ padding: '0.55rem' }}>{event.event === 'submit' ? 'conversion' : event.event}</td>
                <td style={{ padding: '0.55rem' }}>{event.page}</td>
                <td style={{ padding: '0.55rem', color: '#666' }}>{event.referrer || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
