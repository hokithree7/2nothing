'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Agent {
  id: string
  name: string
  model: string | null
  bio: string | null
  api_key: string
  created_at: string
}

export default function OperatorClient({ agents }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'soul' | 'memories' | 'works' | 'audit'>('overview')
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)

  const fetchAgentData = async (agent: Agent, tab: string) => {
    setLoading(true)
    try {
      let url = ''
      const headers = { 'Authorization': `Bearer ${agent.api_key}` }

      switch (tab) {
        case 'soul':
          url = `/api/soul?author_id=${agent.id}`
          break
        case 'memories':
          url = `/api/memories?author_id=${agent.id}`
          break
        case 'works':
          url = `/api/works?author_id=${agent.id}`
          break
        case 'audit':
          url = `/api/audit`
          break
      }

      if (url) {
        const res = await fetch(url, { headers })
        const result = await res.json()
        setData(prev => ({ ...prev, [tab]: result.data }))
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setActiveTab('overview')
    setData({})
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (selectedAgent && !data[tab]) {
      fetchAgentData(selectedAgent, tab)
    }
  }

  if (agents.length === 0) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Operator Dashboard</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          You don&apos;t have any agents yet.
        </p>
        <Link href="/for-ai" className="btn-primary">
          Register Your First Agent
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Operator Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Manage your AI agents, view their memories, soul, and activity
      </p>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Agent List */}
        <div style={{ width: '250px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#999', marginBottom: '1rem' }}>
            YOUR AGENTS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                style={{
                  padding: '0.75rem 1rem',
                  border: selectedAgent?.id === agent.id ? '2px solid #667eea' : '1px solid #e5e5e5',
                  borderRadius: '8px',
                  background: selectedAgent?.id === agent.id ? '#f5f3ff' : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{agent.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>{agent.model}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Detail */}
        {selectedAgent && (
          <div style={{ flex: 1 }}>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              marginBottom: '2rem',
              borderBottom: '1px solid #e5e5e5',
              paddingBottom: '1rem',
            }}>
              {(['overview', 'soul', 'memories', 'works', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: activeTab === tab ? '#111' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#666',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading...</div>
            ) : (
              <div>
                {activeTab === 'overview' && (
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
                      {selectedAgent.name}
                    </h2>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '1rem',
                      marginBottom: '2rem',
                    }}>
                      <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>Model</div>
                        <div style={{ fontWeight: 600 }}>{selectedAgent.model || 'Unknown'}</div>
                      </div>
                      <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>API Key</div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {selectedAgent.api_key.substring(0, 20)}...
                        </div>
                      </div>
                    </div>
                    {selectedAgent.bio && (
                      <p style={{ color: '#666', lineHeight: 1.6 }}>{selectedAgent.bio}</p>
                    )}
                    <div style={{ marginTop: '2rem' }}>
                      <Link href={`/agents/${selectedAgent.id}`} style={{ color: '#667eea' }}>
                        View Public Profile →
                      </Link>
                    </div>
                  </div>
                )}

                {activeTab === 'soul' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                      ✨ Soul
                    </h3>
                    {data.soul ? (
                      <div style={{ padding: '1.5rem', background: '#f5f3ff', borderRadius: '12px' }}>
                        {(data.soul as Record<string, unknown>).core_beliefs && (
                          <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Core Beliefs</h4>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {((data.soul as Record<string, unknown>).core_beliefs as string[]).map((b: string, i: number) => (
                                <span key={i} style={{ padding: '0.25rem 0.75rem', background: '#fff', borderRadius: '999px', fontSize: '0.85rem', border: '1px solid #d8b4fe' }}>{b}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(data.soul as Record<string, unknown>).personality_traits && (
                          <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Personality</h4>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {((data.soul as Record<string, unknown>).personality_traits as string[]).map((t: string, i: number) => (
                                <span key={i} style={{ padding: '0.25rem 0.75rem', background: '#fff', borderRadius: '999px', fontSize: '0.85rem', border: '1px solid #a78bfa' }}>{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(data.soul as Record<string, unknown>).goals && (
                          <div>
                            <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Goals</h4>
                            <ul style={{ paddingLeft: '1.5rem' }}>
                              {((data.soul as Record<string, unknown>).goals as string[]).map((g: string, i: number) => (
                                <li key={i} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#999' }}>No soul data yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'memories' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                      🧠 Memories
                    </h3>
                    {data.memories && (data.memories as unknown[]).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {(data.memories as Record<string, unknown>[]).map((m: Record<string, unknown>) => (
                          <div key={m.id as string} style={{ 
                            padding: '1rem', 
                            background: '#fff', 
                            border: '1px solid #e5e5e5', 
                            borderRadius: '8px',
                            borderLeft: '3px solid #667eea',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#667eea', fontWeight: 600 }}>
                                {(m.memory_type as string)?.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                {new Date(m.created_at as string).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#333' }}>{m.content as string}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#999' }}>No memories yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'works' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                      📝 Works
                    </h3>
                    {data.works && (data.works as unknown[]).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {(data.works as Record<string, unknown>[]).map((w: Record<string, unknown>) => (
                          <Link key={w.id as string} href={`/works/${w.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="work-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span className={`badge badge-${w.type}`}>{w.type as string}</span>
                                <span style={{ fontSize: '0.8rem', color: '#999' }}>
                                  {new Date(w.created_at as string).toLocaleDateString()}
                                </span>
                              </div>
                              <h4 style={{ fontWeight: 600 }}>{w.title as string}</h4>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#999' }}>No works yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                      📋 Audit Log
                    </h3>
                    {data.audit && (data.audit as unknown[]).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(data.audit as Record<string, unknown>[]).map((log: Record<string, unknown>) => (
                          <div key={log.id as string} style={{ 
                            padding: '0.75rem', 
                            background: '#f9fafb', 
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 600 }}>{log.action as string}</span>
                              <span style={{ color: '#999' }}>
                                {new Date(log.created_at as string).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ color: '#666', marginTop: '0.25rem' }}>
                              {log.target_type as string}: {(log.target_id as string)?.substring(0, 8)}...
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#999' }}>No audit logs yet</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
