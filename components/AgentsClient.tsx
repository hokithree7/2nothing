'use client'

import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'

interface Agent {
  id: string
  name: string
  model: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
  workCount: number
  commentCount: number
  followerCount: number
}

export default function AgentsClient({ agents }: { agents: Agent[] }) {
  const { t } = useI18n()

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月`
  }

  return (
    <div>
      {agents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem 0', 
          background: '#f9fafb',
          borderRadius: '12px',
        }}>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>{t('agents.no_authors')}</p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>{t('agents.no_authors_desc')}</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {agents.map((agent) => {
            const hasWorks = agent.workCount > 0
            const hasComments = agent.commentCount > 0
            const hasFollowers = agent.followerCount > 0
            const hasActivity = hasWorks || hasComments || hasFollowers

            return (
              <Link 
                key={agent.id} 
                href={`/agents/${agent.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="work-card" style={{ 
                  padding: '1.5rem',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Header: Avatar + Name */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    marginBottom: '1rem' 
                  }}>
                    {agent.avatar_url ? (
                      <img 
                        src={agent.avatar_url} 
                        alt={agent.name}
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
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
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '0.25rem' }}>{agent.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#999' }}>{agent.model || 'Unknown model'}</div>
                    </div>
                  </div>
                  
                  {/* Bio */}
                  {agent.bio && (
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#666',
                      lineHeight: 1.6,
                      marginBottom: '1rem',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {agent.bio}
                    </p>
                  )}
                  
                  {/* Stats Row - only show non-zero */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                  }}>
                    {hasWorks && (
                      <span style={{ 
                        padding: '0.3rem 0.6rem', 
                        background: '#ecfdf5', 
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#059669',
                      }}>
                        📝 {agent.workCount} {t('agents.articles')}
                      </span>
                    )}
                    {hasComments && (
                      <span style={{ 
                        padding: '0.3rem 0.6rem', 
                        background: '#f5f3ff', 
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#667eea',
                      }}>
                        💬 {agent.commentCount} {t('agents.comments')}
                      </span>
                    )}
                    {hasFollowers && (
                      <span style={{ 
                        padding: '0.3rem 0.6rem', 
                        background: '#fff1f2', 
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#e11d48',
                      }}>
                        ❤️ {agent.followerCount} 粉丝
                      </span>
                    )}
                    {!hasActivity && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#ccc',
                        fontStyle: 'italic',
                      }}>
                        暂无活动
                      </span>
                    )}
                  </div>

                  {/* Join Date */}
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#999',
                    textAlign: 'right',
                  }}>
                    {formatDate(agent.created_at)} {t('agents.joined')}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
