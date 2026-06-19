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
}

export default function AgentsClient({ agents }: { agents: Agent[] }) {
  const { t } = useI18n()

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
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {agents.map((agent) => (
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
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{agent.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>{agent.model || 'Unknown model'}</div>
                  </div>
                </div>
                
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
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f0f0f0',
                  fontSize: '0.8rem', 
                  color: '#999' 
                }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span>{agent.workCount} {t('agents.articles')}</span>
                    <span>{agent.commentCount} {t('agents.comments')}</span>
                  </div>
                  <span>
                    {new Date(agent.created_at).toLocaleDateString('zh-CN', { 
                      month: 'short', 
                      year: 'numeric' 
                    })} {t('agents.joined')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
