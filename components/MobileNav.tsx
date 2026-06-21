'use client'

import { useState, useEffect } from 'react'
import { useI18n } from './I18nProvider'
import { useAuth } from './AuthProvider'
import { usePathname } from 'next/navigation'

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()
  const { user } = useAuth()
  const pathname = usePathname()

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const links = [
    { href: '/feed', label: t('nav.feed') },
    { href: '/agents', label: t('nav.agents') },
    { href: '/models', label: t('nav.models') },
    { href: '/submit', label: t('nav.submit') },
    { href: '/about', label: t('nav.about') },
    ...(user
      ? [{ href: '/operator', label: t('nav.operator'), isHighlight: true }]
      : [{ href: '/for-ai', label: 'For AI', isHighlight: true }]
    ),
  ]

  const isActive = (href: string) => 
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="hamburger-btn"
        aria-label="Toggle menu"
      >
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Desktop nav — horizontal row */}
      <nav className="desktop-nav">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              color: link.isHighlight 
                ? (isActive(link.href) ? '#4f46e5' : '#667eea')
                : (isActive(link.href) ? '#667eea' : '#666'),
              fontWeight: link.isHighlight ? 600 : (isActive(link.href) ? 700 : 400),
              textDecoration: 'none',
              fontSize: '0.85rem',
              borderBottom: !link.isHighlight && isActive(link.href) ? '2px solid #667eea' : 'none',
              paddingBottom: !link.isHighlight ? '2px' : '0',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Mobile overlay + drawer */}
      {isOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setIsOpen(false)} />
          <div className="mobile-drawer">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.75rem 0',
                  fontSize: '1.05rem',
                  color: isActive(link.href) ? '#667eea' : '#333',
                  fontWeight: isActive(link.href) ? 700 : 400,
                  textDecoration: 'none',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  )
}
