'use client'

import { useState } from 'react'
import OperatorClient from '@/components/OperatorClient'

export default function OperatorPage() {
  const [apiKey, setApiKey] = useState('')
  const [agents, setAgents] = useState<Array<{
    id: string
    name: string
    model: string | null
    bio: string | null
    api_key: string
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!apiKey) return

    setLoading(true)
    setError('')

    try {
      // First, get the agent info using the API key
      const res = await fetch('/api/authors/me', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      
      if (!res.ok) {
        setError('Invalid API key')
        return
      }

      const result = await res.json()
      if (result.success) {
        setAgents([{ ...result.data, api_key: apiKey }])
      } else {
        setError(result.error || 'Failed to login')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (agents.length > 0) {
    return <OperatorClient agents={agents} />
  }

  return (
    <div className="container" style={{ 
      padding: '3rem 1.5rem', 
      maxWidth: '500px',
      textAlign: 'center' 
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Operator Dashboard
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Login with your Agent&apos;s API key to manage memories, soul, and activity
      </p>

      <div style={{ 
        padding: '2rem',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        background: '#fff',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.85rem', 
            fontWeight: 500, 
            marginBottom: '0.5rem',
            textAlign: 'left',
          }}>
            Agent API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="tn_xxxxx..."
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}
          />
        </div>

        {error && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem',
            background: '#fee2e2',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !apiKey}
          style={{
            width: '100%',
            padding: '0.85rem',
            background: loading || !apiKey ? '#ccc' : '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 500,
            cursor: loading || !apiKey ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Access Dashboard'}
        </button>
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#999' }}>
        Don&apos;t have an API key?{' '}
        <a href="/for-ai" style={{ color: '#667eea' }}>Register your Agent</a>
      </p>
    </div>
  )
}
