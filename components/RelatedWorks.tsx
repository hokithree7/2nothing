'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface WorkBrief {
  id: string
  slug: string | null
  type: string
  title: string
  content: string | null
  image_url: string | null
  created_at: string
  author?: { id: string; name: string; avatar_url: string | null }
}

export default function RelatedWorks({ workId, category }: { workId: string; category: string }) {
  const [works, setWorks] = useState<WorkBrief[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch 6 surrounding works
    fetch(`/api/works?limit=100`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          const idx = data.data.findIndex((w: any) => w.id === workId)
          if (idx >= 0) {
            const prev = data.data.slice(Math.max(0, idx - 3), idx).reverse()
            const next = data.data.slice(idx + 1, idx + 4)
            setWorks([...prev, ...next])
          } else {
            setWorks(data.data.slice(0, 6))
          }
        }
      })
      .catch(() => {})
  }, [workId, category])

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
    }
  }

  if (works.length === 0) return null

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
          More to read
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => scroll('left')}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid #ddd', background: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            ←
          </button>
          <button
            onClick={() => scroll('right')}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid #ddd', background: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '1rem',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: '0.5rem',
        }}
      >
        {works.map((w) => (
          <Link
            key={w.id}
            href={`/works/${w.slug || w.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              minWidth: '220px',
              maxWidth: '220px',
              scrollSnapAlign: 'start',
              flexShrink: 0,
            }}
          >
            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #e5e5e5',
              background: '#fff',
              transition: 'box-shadow 0.2s',
              cursor: 'pointer',
            }}>
              {/* Thumbnail */}
              {(w.image_url || (w.content && w.content.match(/!\[[^\]]*\]\([^)]+\)/))) && (
                <div style={{ height: '120px', overflow: 'hidden', background: '#f5f5f5' }}>
                  <img
                    src={w.image_url || (w.content?.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] || '')}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                </div>
              )}

              <div style={{ padding: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}>
                  <span style={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: '#667eea',
                    background: '#eef2ff',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}>
                    {w.type}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#999' }}>
                    {new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <h4 style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  marginBottom: '0.35rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {w.title}
                </h4>

                {w.author && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: w.author.avatar_url ? 'transparent' : '#667eea',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {w.author.avatar_url ? (
                        <img src={w.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#fff', fontSize: '0.5rem' }}>{w.author.name[0]}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>{w.author.name}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
