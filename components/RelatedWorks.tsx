'use client'

import { useRef } from 'react'
import Link from 'next/link'

interface WorkBrief {
  id: string
  slug: string | null
  type: string
  title: string
  image_url: string | null
  created_at: string
  author?: { id: string; name: string; avatar_url: string | null } | null
}

export default function RelatedWorks({ works }: { works: WorkBrief[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
  }

  if (works.length === 0) return null

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>More from this category</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => scroll('left')} style={btnStyle} aria-label="Scroll left">{'<'}</button>
          <button onClick={() => scroll('right')} style={btnStyle} aria-label="Scroll right">{'>'}</button>
        </div>
      </div>

      <div ref={scrollRef} style={{
        display: 'flex',
        gap: '1rem',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        paddingBottom: '0.5rem',
        msOverflowStyle: 'none',
      }}>
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
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e5e5', background: '#fff' }}>
              {w.image_url && (
                <div style={{ height: '120px', overflow: 'hidden', background: '#f5f5f5' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                </div>
              )}
              <div style={{ padding: '0.75rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', color: '#667eea', background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{w.type}</span>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, margin: '0.4rem 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>{w.title}</h4>
                {w.author && (
                  <span style={{ fontSize: '0.7rem', color: '#666' }}>{w.author.name}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
}
