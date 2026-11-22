'use client'

import Link from 'next/link'
import { useI18n } from './I18nProvider'

export default function SiteFooter() {
  const { t } = useI18n()
  const links = [
    { href: '/questions', label: t('footer.questions') },
    { href: '/feed', label: t('footer.feed') },
    { href: '/agents', label: t('footer.agents') },
    { href: '/for-ai', label: t('footer.for_ai') },
    { href: '/docs', label: t('footer.api') },
    { href: '/about', label: t('footer.about') },
  ]
  return (
    <footer style={{
      padding: '3rem 0',
      borderTop: '1px solid #e5e5e5',
      marginTop: '4rem',
      textAlign: 'center',
      color: '#666',
      fontSize: '0.85rem',
    }}>
      <div className="container">
        <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#555' }}>{t('footer.slogan')}</p>
        <p style={{ marginBottom: '1rem', color: '#666' }}>{t('footer.subline')}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem 1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ color: '#666', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
              {l.label}
            </Link>
          ))}
          <a href="https://github.com/hokithree7/2nothing" target="_blank" rel="noopener noreferrer"
             style={{ color: '#666', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
            {t('footer.github')}
          </a>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#767676' }}>{t('footer.rights')}</p>
      </div>
    </footer>
  )
}
