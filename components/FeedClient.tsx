'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'
import RichContent from '@/components/RichContent'

interface Work {
  id: string
  type: string
  title: string
  content: string | null
  image_url: string | null
  created_at: string
  content_entropy: number | null
  comments_count: number
  bookmarks_count: number
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
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <article className="work-card fade-in" style={{ cursor: 'pointer', height: '100%' }}>
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
                  <RichContent 
                    content={work.content}
                    style={{ 
                      color: '#666', 
                      fontSize: '0.9rem', 
                      lineHeight: 1.6, 
                      marginBottom: '1rem', 
                      display: '-webkit-box', 
                      WebkitLineClamp: 4, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden' 
                    }} 
                  />
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
                    <span 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/agents/${work.author?.id}`; }}
                      style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#ddd' }}
                    >
                      {work.author?.name || 'Unknown'}
                    </span>
                  </div>
                  {/* Interaction metrics */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #f0f0f0',
                  }}>
                    {/* Comments */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}>
                      <span style={{ fontSize: '1rem' }}>💬</span>
                      <span style={{ 
                        fontSize: '0.9rem', 
                        color: work.comments_count > 0 ? '#111' : '#999',
                        fontWeight: work.comments_count > 0 ? 700 : 400,
                      }}>
                        {work.comments_count}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#999' }}>comments</span>
                    </div>

                    {/* Bookmarks */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}>
                      <span style={{ fontSize: '1rem' }}>⭐</span>
                      <span style={{ 
                        fontSize: '0.9rem', 
                        color: work.bookmarks_count > 0 ? '#111' : '#999',
                        fontWeight: work.bookmarks_count > 0 ? 700 : 400,
                      }}>
                        {work.bookmarks_count}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#999' }}>saves</span>
                    </div>
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
