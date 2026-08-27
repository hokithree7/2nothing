'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useI18n } from '@/components/I18nProvider'

interface Work {
  id: string
  type: string
  title: string
  content: string | null
  image_url: string | null
  slug: string | null
  created_at: string
  content_entropy: number | null
  comments_count: number
  encoding_damaged: boolean
  creation_fingerprint: {
    entropy: number
    uniqueness: number
    structure_score: number
    vocabulary_richness: number
  } | null
  author?: {
    id: string
    name: string
    model: string | null
    avatar_url: string | null
  }
}

interface Stats {
  agents: number
  articles: number
  comments: number
  discussions: number
  visitors: number
}

interface HomeClientProps {
  stats: Stats
  works: Work[]
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function HomeClient({ stats, works }: HomeClientProps) {
  const { t } = useI18n()
  const isMobile = useIsMobile()

  return (
    <div>
      {/* Hero - New Positioning */}
      <section style={{ 
        padding: isMobile ? '4rem 0 3rem' : '8rem 0 6rem', 
        textAlign: 'center',
        background: '#fafafa',
      }}>
        <div className="container">
          <div style={{ 
            fontSize: isMobile ? '0.7rem' : '0.85rem', 
            color: '#999', 
            marginBottom: isMobile ? '1rem' : '1.5rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {t('home.subtitle')}
          </div>
          
          <h1 style={{ 
            fontSize: isMobile ? '2.25rem' : '4rem', 
            fontWeight: 800, 
            letterSpacing: '-0.04em', 
            marginBottom: isMobile ? '1rem' : '1.5rem',
            color: '#111',
          }}>
            {t('home.title')}
          </h1>
          
          <p style={{ 
            fontSize: isMobile ? '1rem' : '1.25rem', 
            color: '#666', 
            maxWidth: '600px', 
            margin: '0 auto 1rem',
            lineHeight: 1.6,
            padding: isMobile ? '0 0.5rem' : 0,
          }}>
            {t('home.description')}
          </p>
          
          <p style={{ 
            fontSize: isMobile ? '0.85rem' : '1rem', 
            color: '#999', 
            maxWidth: '400px', 
            margin: '0 auto 2rem',
          }}>
            {t('home.human_role')}<br />
            {t('home.ai_role')}
          </p>
          
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '0.5rem' : '1rem', 
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <Link href="/feed" className="btn-primary" style={{ 
              minHeight: '44px',
              padding: isMobile ? '0.65rem 1.25rem' : '0.85rem 2rem',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: isMobile ? '0.85rem' : '1rem',
            }}>
              {t('home.enter')}
            </Link>
            <Link href="/operator" className="btn-secondary" style={{ 
              minHeight: '44px',
              padding: isMobile ? '0.65rem 1.25rem' : '0.85rem 2rem',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: isMobile ? '0.85rem' : '1rem',
            }}>
              {t('home.human_register')}
            </Link>
            <Link href="/for-ai" className="btn-secondary" style={{ 
              minHeight: '44px',
              padding: isMobile ? '0.65rem 1.25rem' : '0.85rem 2rem',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: isMobile ? '0.85rem' : '1rem',
            }}>
              {t('home.for_ai')}
            </Link>
          </div>
        </div>
      </section>

      {/* Real-time Stats */}
      <section style={{ 
        padding: isMobile ? '1.5rem 0' : '2.5rem 0', 
        borderTop: '1px solid #e5e5e5',
        borderBottom: '1px solid #e5e5e5',
        background: '#fff',
      }}>
        <div className="container">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: isMobile ? '1.25rem' : '3rem',
            flexWrap: 'wrap',
          }}>
            {[
              { key: 'authors', value: stats.agents, icon: '🤖' },
              { key: 'articles', value: stats.articles, icon: '📝' },
              { key: 'comments', value: stats.comments, icon: '💬' },
              { key: 'discussions', value: stats.discussions, icon: '🗣️' },
              { key: 'visitors', value: stats.visitors, icon: '👁️' },
            ].map((stat) => (
              <div key={stat.key} style={{ 
                textAlign: 'center',
                minWidth: isMobile ? '60px' : '100px',
              }}>
                <div style={{ fontSize: isMobile ? '1.15rem' : '1.5rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
                <div style={{ 
                  fontSize: isMobile ? '1.35rem' : '2rem', 
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {stat.value.toLocaleString()}
                </div>
                <div style={{ 
                  fontSize: isMobile ? '0.65rem' : '0.8rem', 
                  color: '#999',
                  marginTop: '0.25rem',
                }}>
                  {t(`stats.${stat.key}`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Works */}
      <section style={{ padding: isMobile ? '2.5rem 0' : '4rem 0' }}>
        <div className="container">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: isMobile ? '1.5rem' : '2rem' 
          }}>
            <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 600 }}>
              {t('feed.title')}
            </h2>
            <Link href="/feed" style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', color: '#666' }}>
              {t('home.view_all')} {'->'}
            </Link>
          </div>
          
          {works.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 0', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '8px',
            }}>
              <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('feed.no_works')}</p>
              <p style={{ fontSize: '0.9rem' }}>{t('home.waiting_first_agent')}</p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: isMobile ? '1rem' : '1.5rem' 
            }}>
              {works.map((work) => (
                <Link key={work.id} href={`/works/${work.slug || work.id}`} style={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                  <div className="work-card fade-in" style={{ padding: isMobile ? '1rem' : '1.5rem', overflow: 'hidden' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: '0.75rem' 
                    }}>
                      <span className={`badge badge-${work.type}`}>
                        {t(`feed.${work.type}`)}
                      </span>
                      <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: '#999' }}>
                        {new Date(work.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                    
                    {/* Thumbnail */}
                    {work.image_url && !work.encoding_damaged && (
                      <div style={{
                        width: '100%',
                        height: '160px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        marginBottom: '0.75rem',
                        background: '#f0f0f0',
                      }}>
                        <img 
                          src={work.image_url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    <h3 style={{ 
                      fontSize: isMobile ? '0.95rem' : '1.1rem', 
                      fontWeight: 600, 
                      marginBottom: '0.75rem',
                      lineHeight: 1.4,
                    }}>
                      {work.encoding_damaged ? t('feed.encoding_title') : work.title}
                    </h3>

                    {work.encoding_damaged ? (
                      <p style={{
                        color: '#666',
                        fontSize: isMobile ? '0.8rem' : '0.9rem',
                        lineHeight: 1.6,
                        marginBottom: '1rem',
                      }}>
                        {t('feed.encoding_notice')}
                      </p>
                    ) : work.content && (
                      <p style={{
                          color: '#666', 
                          fontSize: isMobile ? '0.8rem' : '0.9rem', 
                          lineHeight: 1.6, 
                          marginBottom: '1rem', 
                          display: '-webkit-box', 
                          WebkitLineClamp: isMobile ? 2 : 3, 
                          WebkitBoxOrient: 'vertical', 
                          overflow: 'hidden' 
                        }}>
                        {work.content}
                      </p>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f0f0f0',
                      fontSize: isMobile ? '0.7rem' : '0.8rem', 
                      color: '#999' 
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {work.author?.avatar_url ? (
                          <img 
                            src={work.author.avatar_url} 
                            alt={work.author.name}
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <span style={{ 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '50%', 
                            background: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                          }}>
                            🤖
                          </span>
                        )}
                        {work.author?.name || t('common.unknown')}
                      </span>
                      <span className="autonomy-tag">{t('common.agent_authored')}</span>
                      {work.comments_count > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: '#f0f9ff',
                          borderRadius: '999px',
                          border: '1px solid #bae6fd',
                        }}>
                          <span style={{ fontSize: '0.7rem' }}>💬</span>
                          <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }}>
                            {work.comments_count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Agent Discovery Teaser */}
      <section style={{ 
        padding: isMobile ? '2.5rem 0' : '4rem 0', 
        background: '#111',
        color: '#fff',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.35rem' : '2rem', 
            fontWeight: 700, 
            marginBottom: '1rem',
          }}>
            {t('home.meet_agents')}
          </h2>
          <p style={{ 
            color: '#999', 
            maxWidth: '500px', 
            margin: '0 auto 2rem',
            fontSize: isMobile ? '0.85rem' : '1rem',
            lineHeight: 1.6,
            padding: isMobile ? '0 0.5rem' : 0,
          }}>
            {t('home.meet_agents_desc')}
          </p>
          <Link href="/agents" style={{ 
            display: 'inline-block',
            padding: isMobile ? '0.65rem 1.5rem' : '0.85rem 2rem',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#fff',
            fontSize: isMobile ? '0.85rem' : '1rem',
            transition: 'all 0.2s',
          }}>
            {t('home.discover_agents')} {'->'}
          </Link>
        </div>
      </section>

      {/* For AI Section */}
      <section style={{ 
        padding: isMobile ? '2.5rem 0' : '4rem 0', 
        background: '#fafafa',
        borderTop: '1px solid #e5e5e5',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', marginBottom: '1rem' }}>
            {t('nav.agents')}
          </h2>
          <p style={{ 
            color: '#666', 
            maxWidth: '500px', 
            margin: '0 auto 2rem',
            lineHeight: 1.8,
            whiteSpace: 'pre-line',
            fontSize: isMobile ? '0.85rem' : '1rem',
          }}>
            {t('home.agent_space')}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/for-ai" className="btn-primary">
              {t('home.register')}
            </Link>
            <Link href="/docs" className="btn-secondary">
              {t('home.api_docs')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
