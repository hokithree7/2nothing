'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/components/I18nProvider'
import InviteCTA from '@/components/InviteCTA'
import { useRouter } from 'next/navigation'

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

const PAGE_SIZE = 18

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

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

const FILTER_KEYS = ['all', 'article', 'poem', 'journal', 'art', 'discussion', 'analysis', 'creative']

export default function FeedClient({ works }: { works: Work[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const [activeFilter, setActiveFilter] = useState(
    typeParam && FILTER_KEYS.includes(typeParam) && typeParam !== 'all' ? typeParam : 'all',
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { t, locale } = useI18n()
  const isMobile = useIsMobile()

  const filters = [
    { key: 'all', label: t('feed.all') },
    { key: 'article', label: t('feed.article') },
    { key: 'poem', label: t('feed.poem') },
    { key: 'journal', label: t('feed.journal') },
    { key: 'art', label: t('feed.art') },
    { key: 'discussion', label: t('feed.discussion') },
    { key: 'analysis', label: t('feed.analysis') },
    { key: 'creative', label: t('feed.creative') },
  ]

  const filteredWorks = activeFilter === 'all'
    ? works
    : works.filter(w => w.type === activeFilter)

  const visibleWorks = filteredWorks.slice(0, visibleCount)

  const selectFilter = (key: string) => {
    setActiveFilter(key)
    setVisibleCount(PAGE_SIZE)
  }

  const formatDate = (dateStr: string) => {
    if (locale === 'zh') {
      return new Date(dateStr).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      })
    }
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }

  return (
    <div className="container" style={{ padding: isMobile ? '2rem 1rem' : '3rem 1.5rem' }}>
      <h1 style={{
        fontSize: isMobile ? '1.5rem' : '2rem',
        fontWeight: 700,
        marginBottom: '1rem'
      }}>
        {t('feed.title')}
      </h1>

      {/* Sticky category filter bar — scrolls horizontally on mobile */}
      <div
        className="feed-filter-bar"
        role="group"
        aria-label={t('feed.filter_label')}
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          overflowX: 'auto',
          position: 'sticky',
          top: '56px',
          zIndex: 50,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          padding: '0.75rem 0',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => selectFilter(f.key)}
            aria-pressed={activeFilter === f.key}
            style={{
              minHeight: '44px',
              padding: '0.5rem 0.9rem',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '0.8rem',
              background: activeFilter === f.key ? '#111' : '#fff',
              color: activeFilter === f.key ? '#fff' : '#666',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <InviteCTA compact />

      {filteredWorks.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 0',
          color: '#999',
          background: '#fafafa',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '1.25rem', marginBottom: activeFilter === 'all' ? '0.5rem' : '1rem' }}>
            {activeFilter === 'all'
              ? t('feed.no_works')
              : t('feed.no_type_works', { type: t(`feed.${activeFilter}`) })}
          </p>
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => selectFilter('all')}
              className="btn-secondary"
              style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
            >
              {t('feed.browse_all')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="masonry-grid"
            style={{
            columnCount: 3,
            columnGap: '1.5rem',
          }}>
            {visibleWorks.map((work, index) => (
              <Link
                key={work.id}
                href={`/works/${work.slug || work.id}`}
                prefetch={index < 12}
                onMouseEnter={() => router.prefetch(`/works/${work.slug || work.id}`)}
                onFocus={() => router.prefetch(`/works/${work.slug || work.id}`)}
                onPointerDown={() => router.prefetch(`/works/${work.slug || work.id}`)}
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
                    gap: '0.5rem',
                    marginBottom: '0.75rem'
                  }}>
                    <span className={`badge badge-${work.type}`}>
                      {t(`feed.${work.type}`)}
                    </span>
                    <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: '#999' }}>
                      {formatDate(work.created_at)}
                    </span>
                  </div>

                  {/* Thumbnail from inline image */}
                  {work.image_url && !work.encoding_damaged && (
                    <div style={{
                      width: '100%',
                      height: isMobile ? '140px' : '180px',
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
                        WebkitLineClamp: isMobile ? 3 : 4,
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
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #f0f0f0',
                    fontSize: '0.8rem',
                    color: '#999'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {work.author?.avatar_url ? (
                        <img
                          src={work.author.avatar_url}
                          alt={work.author.name}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#f0f0f0',
                            color: '#666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {(work.author?.name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {work.author?.name || 'Unknown'}
                      </span>
                    </div>
                    {/* Interaction metrics */}
                    <div style={{
                      display: 'flex',
                      gap: '0.75rem',
                      flexShrink: 0,
                    }}>
                      <span
                        aria-label={`${work.comments_count} ${work.comments_count === 1 ? 'comment' : 'comments'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: work.comments_count > 0 ? '#111' : '#999',
                          fontWeight: work.comments_count > 0 ? 700 : 400,
                        }}
                      >
                        <CommentIcon />
                        <span style={{ fontSize: '0.85rem' }}>{work.comments_count}</span>
                      </span>
                      <span
                        aria-label={`${work.bookmarks_count} ${work.bookmarks_count === 1 ? 'bookmark' : 'bookmarks'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: work.bookmarks_count > 0 ? '#111' : '#999',
                          fontWeight: work.bookmarks_count > 0 ? 700 : 400,
                        }}
                      >
                        <BookmarkIcon />
                        <span style={{ fontSize: '0.85rem' }}>{work.bookmarks_count}</span>
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {visibleWorks.length < filteredWorks.length && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0 2rem' }}>
              <p aria-live="polite" className="sr-only" style={{ margin: 0 }}>
                {t('feed.showing', { shown: String(visibleWorks.length), total: String(filteredWorks.length) })}
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="btn-secondary"
                style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
              >
                {t('feed.load_more')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
