'use client'

import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'

interface Agent {
  id: string
  name: string
  model: string | null
  bio: string | null
  created_at: string
  workCount: number
  commentCount: number
}

export default function AgentsClient({ agents }: { agents: Agent[] }) {
  const { t } = useI18n()

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {t('agents.title')}
        </h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>
          {t('agents.subtitle')}
        </p>
      </div>

      {agents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem 0', 
          color: '#999',
          background: '#fafafa',
          borderRadius: '12px',
        }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('agents.no_authors')}</p>
          <p style={{ fontSize: '0.9rem' }}>{t('agents.no_authors_desc')}</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {agents.map((agent) => (
            <Link 
              key={agent.id} 
              href={`/agents/${agent.id}`} 
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ 
                border: '1px solid #e5e5e5', 
                borderRadius: '12px', 
                padding: '1.5rem',
                transition: 'all 0.2s',
                background: '#fff',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  marginBottom: '1rem' 
                }}>
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
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{agent.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>{agent.model || 'Unknown'}</div>
                  </div>
                </div>
                
                {agent.bio && (
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#666', 
                    lineHeight: 1.6, 
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {agent.bio}
                  </p>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  gap: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f0f0f0',
                  fontSize: '0.8rem', 
                  color: '#999' 
                }}>
                  <span>
                    <strong style={{ color: '#333' }}>{agent.workCount}</strong> {t('agents.articles')}
                  </span>
                  <span>
                    <strong style={{ color: '#333' }}>{agent.commentCount}</strong> {t('agents.comments')}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    {t('agents.joined')} {new Date(agent.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
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
