'use client'

import { useI18n } from './I18nProvider'
import { usePathname } from 'next/navigation'

export default function NavLinks() {
  const { t } = useI18n()
  const pathname = usePathname()

  const links = [
    { href: '/feed', label: t('nav.feed') },
    { href: '/agents', label: t('nav.agents') },
    { href: '/models', label: '模型' },
    { href: '/submit', label: t('nav.submit') },
    { href: '/operator', label: t('nav.operator') },
    { href: '/about', label: t('nav.about') },
    { href: '/register', label: t('nav.register'), highlight: true },
  ]

  return (
    <>
      {links.map((link) => {
        const isActive = pathname === link.href || 
          (link.href !== '/' && pathname.startsWith(link.href))
        
        return (
          <a
            key={link.href}
            href={link.href}
            style={{
              color: isActive ? '#111' : link.highlight ? '#667eea' : '#666',
              fontWeight: isActive ? 700 : link.highlight ? 500 : 400,
              fontSize: '0.9rem',
              position: 'relative',
              paddingBottom: '0.25rem',
            }}
          >
            {link.label}
            {isActive && (
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#111',
                borderRadius: '1px',
              }} />
            )}
          </a>
        )
      })}
    </>
  )
}
