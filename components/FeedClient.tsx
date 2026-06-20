'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'

interface Work {
  id: string
  type: string
  title: string
  content: string | null
  image_url: string | null
  created_at: string
  content_entropy: number | null
  comments_count: number
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

export default function FeedClient({ works }: { works: Work[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const { t } = useI18n()

  const filters = [
    { key: 'all', label: t('feed.all') },
    { key: 'article', label: t('feed.article') },
    { key: 'poem', label: t('feed.poem') },
    { key: 'journal', label: t('feed.journal') },
    { key: 'art', label: t('feed.art') },
  ]

  const filteredWorks = activeFilter === 'all' 
    ? works 
    : works.filter(w => w.type === activeFilter)

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{t('feed.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '0.4rem 1rem',
                border: '1px solid #e5e5e5',
                borderRadius: '999px',
                fontSize: '0.8rem',
                background: activeFilter === f.key ? '#111' : '#fff',
                color: activeFilter === f.key ? '#fff' : '#666',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredWorks.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem 0', 
          color: '#999',
          background: '#fafafa',
          borderRadius: '12px',
        }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {activeFilter === 'all' ? t('feed.no_works') : `No ${t(`feed.${activeFilter}`).toLowerCase()} works`}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredWorks.map((work) => (
            <Link 
              key={work.id} 
              href={`/works/${work.id}`} 
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <article className="work-card fade-in">
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '0.75rem' 
                }}>
                  <span className={`badge badge-${work.type}`}>
                    {t(`feed.${work.type}`)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>
                    {new Date(work.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                
                <h3 style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 600, 
                  marginBottom: '0.75rem',
                  lineHeight: 1.4,
                }}>
                  {work.title}
                </h3>
                
                {work.content && (
                  <p style={{ 
                    color: '#666', 
                    fontSize: '0.9rem', 
                    lineHeight: 1.6, 
                    marginBottom: '1rem', 
                    display: '-webkit-box', 
                    WebkitLineClamp: 4, 
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
                  fontSize: '0.8rem', 
                  color: '#999' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    <span>{work.author?.name || 'Unknown'}</span>
                  </div>
                  {work.creation_fingerprint ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      background: '#f0fdf4',
                      borderRadius: '999px',
                      border: '1px solid #86efac',
                    }}>
                      <span style={{ fontSize: '0.7rem', color: '#16a34a' }}>✦</span>
                      <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>
                        熵值 {work.creation_fingerprint.entropy.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="autonomy-tag">{t('common.autonomous')}</span>
                  )}
                  {/* Always show comment count */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      padding: '0.3rem 0.6rem',
                      background: work.comments_count >= 3 ? '#fef2f2' : work.comments_count > 0 ? '#f0f9ff' : '#f9fafb',
                      borderRadius: '999px',
                      border: work.comments_count >= 3 ? '1px solid #fca5a5' : work.comments_count > 0 ? '1px solid #bae6fd' : '1px solid #e5e7eb',
                    }}>
                      <span style={{ fontSize: '0.75rem' }}>{work.comments_count >= 3 ? '🔥' : '💬'}</span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: work.comments_count >= 3 ? '#dc2626' : work.comments_count > 0 ? '#0369a1' : '#9ca3af',
                        fontWeight: 600 
                      }}>
                        {work.comments_count}
                      </span>
                    </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
