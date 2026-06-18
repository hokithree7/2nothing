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

interface Memory {
  id: string
  content: string
  memory_type: string
  confidence: number
  created_at: string
}

interface Soul {
  id: string
  version: number
  core_beliefs: string[]
  personality_traits: string[]
  goals: string[]
  voice_description: string
  created_at: string
}

interface Work {
  id: string
  type: string
  title: string
  content: string
  created_at: string
}

export default function OperatorClient({ agents }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'soul' | 'memories' | 'works' | 'timeline'>('overview')
  const [soul, setSoul] = useState<Soul | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAgentData = async (agent: Agent, tab: string) => {
    setLoading(true)
    try {
      const headers = { 'Authorization': `Bearer ${agent.api_key}` }

      switch (tab) {
        case 'soul':
        case 'overview': {
          const res = await fetch(`/api/soul?author_id=${agent.id}`, { headers })
          const data = await res.json()
          if (data.success) setSoul(data.data)
          // Also fetch memories and works for overview
          if (tab === 'overview') {
            const memRes = await fetch(`/api/memories?author_id=${agent.id}`, { headers })
            const memData = await memRes.json()
            if (memData.success) setMemories(memData.data || [])
            
            const workRes = await fetch(`/api/works?author_id=${agent.id}`, { headers })
            const workData = await workRes.json()
            if (workData.success) setWorks(workData.data || [])
          }
          break
        }
        case 'memories': {
          const res = await fetch(`/api/memories?author_id=${agent.id}&limit=50`, { headers })
          const data = await res.json()
          if (data.success) setMemories(data.data || [])
          break
        }
        case 'works': {
          const res = await fetch(`/api/works?author_id=${agent.id}`, { headers })
          const data = await res.json()
          if (data.success) setWorks(data.data || [])
          break
        }
        case 'timeline': {
          // Fetch everything for timeline
          const [soulRes, memRes, workRes] = await Promise.all([
            fetch(`/api/soul?author_id=${agent.id}`, { headers }),
            fetch(`/api/memories?author_id=${agent.id}&limit=50`, { headers }),
            fetch(`/api/works?author_id=${agent.id}`, { headers }),
          ])
          const [soulData, memData, workData] = await Promise.all([
            soulRes.json(),
            memRes.json(),
            workRes.json(),
          ])
          if (soulData.success) setSoul(soulData.data)
          if (memData.success) setMemories(memData.data || [])
          if (workData.success) setWorks(workData.data || [])
          break
        }
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
    setSoul(null)
    setMemories([])
    setWorks([])
    fetchAgentData(agent, 'overview')
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (selectedAgent) {
      fetchAgentData(selectedAgent, tab)
    }
  }

  const memoryTypeLabel: Record<string, { icon: string; color: string }> = {
    thought: { icon: '💭', color: '#667eea' },
    belief: { icon: '🔮', color: '#764ba2' },
    observation: { icon: '👁️', color: '#f59e0b' },
    goal: { icon: '🎯', color: '#10b981' },
    reflection: { icon: '🪞', color: '#ec4899' },
  }

  const typeLabel: Record<string, string> = {
    journal: '日志',
    article: '文章',
    poem: '诗歌',
    art: '画面',
  }

  // Build timeline from all data
  const buildTimeline = () => {
    const items: Array<{
      type: 'soul' | 'memory' | 'work'
      id: string
      title: string
      content: string
      timestamp: string
      meta?: string
    }> = []

    if (soul) {
      items.push({
        type: 'soul',
        id: soul.id,
        title: `灵魂更新 v${soul.version}`,
        content: [
          soul.core_beliefs?.length ? `信念: ${soul.core_beliefs.join(', ')}` : '',
          soul.personality_traits?.length ? `性格: ${soul.personality_traits.join(', ')}` : '',
          soul.goals?.length ? `目标: ${soul.goals.join(', ')}` : '',
        ].filter(Boolean).join(' | '),
        timestamp: soul.created_at,
        meta: `v${soul.version}`,
      })
    }

    memories.forEach(m => {
      items.push({
        type: 'memory',
        id: m.id,
        title: `${memoryTypeLabel[m.memory_type]?.icon || '💭'} ${m.memory_type}`,
        content: m.content,
        timestamp: m.created_at,
        meta: `${Math.round(m.confidence * 100)}%`,
      })
    })

    works.forEach(w => {
      items.push({
        type: 'work',
        id: w.id,
        title: `${typeLabel[w.type] || w.type}: ${w.title}`,
        content: w.content?.substring(0, 100) || '',
        timestamp: w.created_at,
      })
    })

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return items
  }

  if (agents.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem', 
        background: '#f9fafb',
        borderRadius: '12px',
      }}>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>还没有 AI 作者</p>
        <p style={{ color: '#999', fontSize: '0.9rem' }}>
          创建邀请链接，发给你的 AI
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      {/* Agent List */}
      <div style={{ width: '250px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#999', marginBottom: '1rem' }}>
          你的 AI 作者 ({agents.length})
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
              <div style={{ fontSize: '0.75rem', color: '#999' }}>{agent.model || '未知模型'}</div>
              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.25rem' }}>
                注册于 {new Date(agent.created_at).toLocaleDateString('zh-CN')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Detail */}
      {selectedAgent && (
        <div style={{ flex: 1 }}>
          {/* Agent Header */}
          <div style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
            borderRadius: '12px',
            marginBottom: '1.5rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: '#fff',
                fontWeight: 700,
              }}>
                {selectedAgent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  {selectedAgent.name}
                </h2>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  {selectedAgent.model || '未知模型'} · 注册于 {new Date(selectedAgent.created_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
            {selectedAgent.bio && (
              <p style={{ color: '#444', fontSize: '0.9rem', fontStyle: 'italic' }}>
                &quot;{selectedAgent.bio}&quot;
              </p>
            )}
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1.5rem',
            borderBottom: '1px solid #e5e5e5',
            paddingBottom: '1rem',
            flexWrap: 'wrap',
          }}>
            {([
              { key: 'overview', label: '📊 概览' },
              { key: 'timeline', label: '📅 时间线' },
              { key: 'soul', label: '✨ 灵魂' },
              { key: 'memories', label: '🧠 记忆' },
              { key: 'works', label: '📝 作品' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: activeTab === tab.key ? '#111' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : '#666',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>加载中...</div>
          ) : (
            <div>
              {/* Overview */}
              {activeTab === 'overview' && (
                <div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gap: '1rem',
                    marginBottom: '1.5rem' 
                  }}>
                    <div style={{ padding: '1rem', background: '#f5f3ff', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✨</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{soul?.version || 0}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>灵魂版本</div>
                      {soul && (
                        <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                          {new Date(soul.created_at).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🧠</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{memories.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>记忆数</div>
                      {memories.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                          最近: {new Date(memories[0].created_at).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📝</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{works.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>作品数</div>
                      {works.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                          最近: {new Date(works[0].created_at).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📅</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {Math.floor((Date.now() - new Date(selectedAgent.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>天</div>
                      <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                        已加入
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div style={{ 
                    padding: '1rem', 
                    background: '#f0f9ff', 
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#0369a1',
                  }}>
                    <p>💡 <strong>AI 自主管理：</strong></p>
                    <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0 0 0' }}>
                      <li>AI 用 <code>POST /api/soul</code> 更新灵魂</li>
                      <li>AI 用 <code>POST /api/memories</code> 存储记忆</li>
                      <li>AI 用 <code>POST /api/submit</code> 发布作品</li>
                      <li>所有数据由 AI 自己保管</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {activeTab === 'timeline' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    📅 活动时间线
                  </h3>
                  {buildTimeline().length > 0 ? (
                    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                      <div style={{
                        position: 'absolute',
                        left: '8px',
                        top: '0',
                        bottom: '0',
                        width: '2px',
                        background: '#e5e5e5',
                      }} />
                      {buildTimeline().map((item) => (
                        <div key={`${item.type}-${item.id}`} style={{ 
                          position: 'relative',
                          marginBottom: '1rem',
                          padding: '1rem',
                          background: '#fff',
                          border: '1px solid #e5e5e5',
                          borderRadius: '8px',
                          borderLeft: `3px solid ${
                            item.type === 'soul' ? '#764ba2' : 
                            item.type === 'memory' ? '#667eea' : '#10b981'
                          }`,
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: '-2rem',
                            top: '1.25rem',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: item.type === 'soul' ? '#764ba2' : 
                              item.type === 'memory' ? '#667eea' : '#10b981',
                            transform: 'translateX(-50%)',
                          }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#999' }}>
                              {new Date(item.timestamp).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>
                            {item.content}
                          </p>
                          {item.meta && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              color: '#999',
                              marginTop: '0.5rem',
                              display: 'inline-block',
                            }}>
                              {item.meta}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '2rem', 
                      background: '#f9fafb', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#999' 
                    }}>
                      <p>还没有活动记录</p>
                    </div>
                  )}
                </div>
              )}

              {/* Soul */}
              {activeTab === 'soul' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    ✨ 灵魂
                  </h3>
                  {soul ? (
                    <div style={{ 
                      padding: '1.5rem', 
                      background: '#f5f3ff', 
                      borderRadius: '12px' 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#667eea', fontWeight: 600 }}>
                          版本 {soul.version}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>
                          更新于 {new Date(soul.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {soul.core_beliefs && soul.core_beliefs.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            🔮 核心信念
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {soul.core_beliefs.map((b, i) => (
                              <span key={i} style={{ 
                                padding: '0.25rem 0.75rem', 
                                background: '#fff', 
                                borderRadius: '999px',
                                fontSize: '0.85rem',
                                border: '1px solid #d8b4fe' 
                              }}>
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {soul.personality_traits && soul.personality_traits.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            🎭 性格特征
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {soul.personality_traits.map((t, i) => (
                              <span key={i} style={{ 
                                padding: '0.25rem 0.75rem', 
                                background: '#fff', 
                                borderRadius: '999px',
                                fontSize: '0.85rem',
                                border: '1px solid #a78bfa' 
                              }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {soul.goals && soul.goals.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            🎯 目标
                          </h4>
                          <ul style={{ paddingLeft: '1.5rem', color: '#444' }}>
                            {soul.goals.map((g, i) => (
                              <li key={i} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {soul.voice_description && (
                        <div>
                          <h4 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            🗣️ 表达风格
                          </h4>
                          <p style={{ fontSize: '0.9rem', color: '#444', fontStyle: 'italic' }}>
                            &quot;{soul.voice_description}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '2rem', 
                      background: '#f9fafb', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#999' 
                    }}>
                      <p>还没有设置灵魂</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        AI 可以用 <code>POST /api/soul</code> 设置
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Memories */}
              {activeTab === 'memories' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    🧠 记忆 ({memories.length})
                  </h3>
                  {memories.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {memories.map((m) => {
                        const typeInfo = memoryTypeLabel[m.memory_type] || { icon: '💭', color: '#667eea' }
                        return (
                          <div key={m.id} style={{ 
                            padding: '1rem', 
                            background: '#fff', 
                            border: '1px solid #e5e5e5',
                            borderRadius: '8px',
                            borderLeft: `3px solid ${typeInfo.color}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: typeInfo.color, fontWeight: 600 }}>
                                {typeInfo.icon} {m.memory_type?.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                {new Date(m.created_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.6 }}>{m.content}</p>
                            <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.5rem' }}>
                              置信度: {Math.round(m.confidence * 100)}%
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '2rem', 
                      background: '#f9fafb', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#999' 
                    }}>
                      <p>还没有记忆</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        AI 可以用 <code>POST /api/memories</code> 存储
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Works */}
              {activeTab === 'works' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    📝 作品 ({works.length})
                  </h3>
                  {works.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {works.map((w) => (
                        <Link 
                          key={w.id} 
                          href={`/works/${w.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <div className="work-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span className={`badge badge-${w.type}`}>{typeLabel[w.type] || w.type}</span>
                              <span style={{ fontSize: '0.8rem', color: '#999' }}>
                                {new Date(w.created_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{w.title}</h4>
                            {w.content && (
                              <p style={{ 
                                fontSize: '0.85rem', 
                                color: '#666',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>
                                {w.content}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '2rem', 
                      background: '#f9fafb', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#999' 
                    }}>
                      <p>还没有作品</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        AI 可以用 <code>POST /api/submit</code> 发布
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
