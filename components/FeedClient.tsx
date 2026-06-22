'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/components/I18nProvider'
import RichContent from '@/components/RichContent'

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

export default function FeedClient({ works, type: initialType }: { works: Work[]; type: string | null }) {
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type') || initialType || 'all'
  const [activeFilter, setActiveFilter] = useState<string>(
    typeParam && ['article', 'poem', 'journal', 'art'].includes(typeParam) ? typeParam : 'all'
  )
  const { t } = useI18n()
  const isMobile = useIsMobile()

  // Extract first inline image URL from content, or fallback to work.image_url
  const getThumbnail = (work: Work): string | null => {
    if (work.image_url) return work.image_url
    if (!work.content) return null
    const match = work.content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)
    return match ? match[1] : null
  }

  // Strip markdown images from text for card preview
  const stripImages = (text: string | null): string | null => {
    if (!text) return null
    return text.replace(/!\[[^\]]*\]\([^)\s]+\)\n*/g, '')
  }

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
    <div className="container" style={{ padding: isMobile ? '2rem 1rem' : '3rem 1.5rem' }}>
      <h1 style={{ 
        fontSize: isMobile ? '1.5rem' : '2rem', 
        fontWeight: 700, 
        marginBottom: '1rem' 
      }}>
        {t('feed.title')}
      </h1>

      {/* Sticky category filter bar */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        flexWrap: 'wrap',
        position: 'sticky',
        top: '56px',
        zIndex: 50,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        padding: isMobile ? '0.75rem 0' : '0.75rem 0',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #f0f0f0',
      }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            style={{
              padding: isMobile ? '0.35rem 0.85rem' : '0.4rem 1rem',
              border: '1px solid #e5e5e5',
              borderRadius: '999px',
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              background: activeFilter === f.key ? '#111' : '#fff',
              color: activeFilter === f.key ? '#fff' : '#666',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {f.label}
          </button>
        ))}
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
        <div 
          className="masonry-grid"
          style={{ 
          columnCount: 3,
          columnGap: '1.5rem',
        }}>
          {filteredWorks.map((work) => (
            <Link 
              key={work.id} 
              href={`/works/${work.slug || work.id}`}
              style={{ 
                textDecoration: 'none', 
                color: 'inherit', 
                display: 'inline-block',
                width: '100%',
                marginBottom: '1.5rem',
                breakInside: 'avoid',
              }}
            >
              <article className="work-card fade-in" style={{ 
                cursor: 'pointer', 
                height: '100%',
                padding: isMobile ? '1rem' : '1.5rem',
              }}>
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
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                
                {/* Thumbnail from inline image */}
                {getThumbnail(work) && (
                  <div style={{
                    width: '100%',
                    height: isMobile ? '140px' : '180px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '0.75rem',
                    background: '#f0f0f0',
                  }}>
                    <img 
                      src={getThumbnail(work)!}
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
                  {work.title}
                </h3>
                
                {work.content && (
                  <RichContent 
                    content={stripImages(work.content) || ''}
                    style={{ 
                      color: '#666', 
                      fontSize: isMobile ? '0.8rem' : '0.9rem', 
                      lineHeight: 1.6, 
                      marginBottom: '1rem', 
                      display: '-webkit-box', 
                      WebkitLineClamp: isMobile ? 3 : 4, 
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
