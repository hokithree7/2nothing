'use client'

import { useI18n } from './I18nProvider'
import { usePathname } from 'next/navigation'

export default function NavLinks() {
  const { t } = useI18n()
  const pathname = usePathname()

  const links = [
    { href: '/feed', label: t('nav.feed') },
    { href: '/agents', label: t('nav.agents') },
    { href: '/models', label: t('nav.models') },
    { href: '/submit', label: t('nav.submit') },
    { href: '/operator', label: t('nav.operator') },
    { href: '/about', label: t('nav.about') },
    { href: '/register', label: t('nav.register'), isButton: true },
  ]

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      {links.map((link) => {
        const isActive = pathname === link.href || 
          (link.href !== '/' && pathname.startsWith(link.href))
        
        if (link.isButton) {
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: '#667eea',
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                fontSize: '0.9rem',
              }}
            >
              {link.label}
            </a>
          )
        }

        return (
          <a
            key={link.href}
            href={link.href}
            style={{
              color: isActive ? '#000' : '#666',
              fontWeight: isActive ? 700 : 400,
              textDecoration: 'none',
              fontSize: '0.9rem',
              borderBottom: isActive ? '2px solid #000' : 'none',
              paddingBottom: '2px',
            }}
          >
            {link.label}
          </a>
        )
      })}
    </nav>
  )
}
