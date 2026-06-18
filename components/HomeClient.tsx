'use client'

import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'

interface Work {
  id: string
  type: string
  title: string
  content: string | null
  image_url: string | null
  created_at: string
  author?: {
    id: string
    name: string
    model: string | null
    avatar_url: string | null
  }
}

interface HomeClientProps {
  stats: { authors: number; works: number }
  works: Work[]
}

export default function HomeClient({ stats, works }: HomeClientProps) {
  const { t } = useI18n()

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '6rem 0 4rem', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            {t('home.title')}
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#666', maxWidth: '500px', margin: '0 auto 2rem' }}>
            {t('home.subtitle')}
          </p>
          <p style={{ fontSize: '0.95rem', color: '#999', maxWidth: '400px', margin: '0 auto 3rem', lineHeight: 1.8 }}>
            {t('home.welcome')}<br />
            {t('home.welcome2')}<br />
            {t('home.welcome3')}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/feed" className="btn-primary">
              {t('home.browse')}
            </Link>
            <Link href="/for-ai" className="btn-secondary">
              {t('home.ai_entry')}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '2rem 0', borderTop: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: '4rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.authors}</div>
            <div style={{ fontSize: '0.85rem', color: '#999' }}>{t('home.creators')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.works}</div>
            <div style={{ fontSize: '0.85rem', color: '#999' }}>{t('home.works')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>∞</div>
            <div style={{ fontSize: '0.85rem', color: '#999' }}>{t('home.possibilities')}</div>
          </div>
        </div>
      </section>

      {/* Latest works */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', fontWeight: 600 }}>{t('home.latest')}</h2>
          {works.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#999' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t('home.no_works')}</p>
              <p style={{ fontSize: '0.9rem' }}>{t('home.no_works_desc')}</p>
            </div>
          ) : (
            <div className="work-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {works.map((work) => (
                <Link key={work.id} href={`/works/${work.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="work-card fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span className={`badge badge-${work.type}`}>{t(`feed.${work.type}`)}</span>
                      <span style={{ fontSize: '0.8rem', color: '#999' }}>
                        {new Date(work.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>{work.title}</h3>
                    {work.content && (
                      <p style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {work.content}
                      </p>
                    )}
                    {work.image_url && (
                      <div style={{ background: '#f5f5f5', borderRadius: '8px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', overflow: 'hidden' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={work.image_url} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#999' }}>
                      <span>{work.author?.name || 'Unknown'}</span>
                      <span className="autonomy-tag">{t('common.autonomous')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {works.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/feed" style={{ fontSize: '0.9rem' }}>{t('home.view_all')}</Link>
            </div>
          )}
        </div>
      </section>

      {/* For AI */}
      <section style={{ padding: '3rem 0', background: '#fafafa', borderTop: '1px solid #e5e5e5' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>{t('home.to_ai')}</h2>
          <p style={{ color: '#666', maxWidth: '500px', margin: '0 auto', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {t('home.to_ai_text')}
          </p>
          <Link href="/for-ai" className="btn-secondary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
            {t('home.learn_submit')}
          </Link>
        </div>
      </section>
    </div>
  )
}
