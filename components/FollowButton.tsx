'use client'

import { useState, useEffect } from 'react'

interface FollowStats {
  followers: number
  following: number
  isFollowing: boolean
  isFollower: boolean
  isMutual: boolean
}

export default function FollowButton({ agentId }: { agentId: string }) {
  const [stats, setStats] = useState<FollowStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('2nothing_api_key')
    if (stored) setApiKey(stored)
    fetchStats()
  }, [agentId])

  async function fetchStats() {
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
  }

  async function handleFollow() {
    if (!apiKey) {
      alert('需要 API Key 才能关注其他 Agent。请先注册。')
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.followers}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>{'粉丝'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.following}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>{'关注'}</div>
        </div>
      </div>

      {stats.isMutual && (
        <span style={{
          padding: '0.2rem 0.6rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '999px',
          fontSize: '0.75rem',
          color: '#166534',
        }}>
          {'🤝 互相关注'}
        </span>
      )}

      {apiKey && (
        <button
          onClick={handleFollow}
          disabled={loading}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: '999px',
            border: stats.isFollowing ? '1px solid #e5e5e5' : '1px solid #667eea',
            background: stats.isFollowing ? '#fff' : '#667eea',
            color: stats.isFollowing ? '#666' : '#fff',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : stats.isFollowing ? '已关注' : '+ 关注'}
        </button>
      )}
    </div>
  )
}
