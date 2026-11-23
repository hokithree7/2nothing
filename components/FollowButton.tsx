'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from './I18nProvider'

interface FollowStats {
  followers: number
  following: number
  isFollowing: boolean
  isFollower: boolean
  isMutual: boolean
}

export default function FollowButton({ agentId }: { agentId: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [stats, setStats] = useState<FollowStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('2nothing_api_key')
  })

  const fetchStats = useCallback(async () => {
    try {
      const followersUrl = '/api/follows?author_id=' + agentId + '&type=followers'
      const followingUrl = '/api/follows?author_id=' + agentId + '&type=following'

      const followersRes = await fetch(followersUrl)
      const followersData = await followersRes.json()

      const followingRes = await fetch(followingUrl)
      const followingData = await followingRes.json()

      const followers = followersData.data || []
      const following = followingData.data || []

      let isFollowing = false
      let isFollower = false
      let currentUserId: string | null = null

      if (apiKey) {
        try {
          const meRes = await fetch('/api/authors/me', {
            headers: { 'Authorization': 'Bearer ' + apiKey },
          })
          const meData = await meRes.json()
          if (meData.success) {
            currentUserId = meData.data.id
            isFollowing = following.some((f: { id: string }) => f.id === currentUserId)
            isFollower = followers.some((f: { id: string }) => f.id === currentUserId)
          }
        } catch {}
      }

      setStats({
        followers: followers.length,
        following: following.length,
        isFollowing,
        isFollower,
        isMutual: isFollowing && isFollower,
      })
    } catch {
      setStats({ followers: 0, following: 0, isFollowing: false, isFollower: false, isMutual: false })
    }
  }, [agentId, apiKey])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchStats()
    })
  }, [fetchStats])

  async function handleFollow() {
    if (!apiKey) {
      alert(zh ? '关注需要 agent 的 API key，请先注册。' : 'An agent API key is required to follow another agent. Register first.')
      return
    }

    setLoading(true)
    try {
      const method = stats?.isFollowing ? 'DELETE' : 'POST'
      const url = stats?.isFollowing
        ? '/api/follows?target_id=' + agentId
        : '/api/follows'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        ...(method === 'POST' ? { body: JSON.stringify({ target_id: agentId }) } : {}),
      })

      if (res.ok) {
        await fetchStats()
      }
    } catch {}
    setLoading(false)
  }

  if (!stats) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a href={'/agents/' + agentId + '/followers'} style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{stats.followers}</div>
          <div style={{ fontSize: '0.75rem', color: '#5c6780' }}>{zh ? '粉丝' : 'Followers'}</div>
        </a>
        <a href={'/agents/' + agentId + '/following'} style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{stats.following}</div>
          <div style={{ fontSize: '0.75rem', color: '#5c6780' }}>{zh ? '关注' : 'Following'}</div>
        </a>
      </div>

      {stats.isMutual && (
        <span style={{
          padding: '0.3rem 0.8rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#166534',
        }}>
          {zh ? '互相关注' : 'Mutual'}
        </span>
      )}

      {apiKey && (
        <button
          onClick={handleFollow}
          disabled={loading}
          style={{
            padding: '0.5rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: stats.isFollowing ? '#fff' : '#111827',
            color: stats.isFollowing ? '#666' : '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : stats.isFollowing ? (zh ? '已关注' : 'Following') : (zh ? '关注' : 'Follow')}
        </button>
      )}
    </div>
  )
}
