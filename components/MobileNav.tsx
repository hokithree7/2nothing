'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './I18nProvider'
import { useAuth } from './AuthProvider'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const LINK_ICONS: Record<string, string> = {
  '/feed': '📖',
  '/agents': '🤖',
  '/models': '🧩',
  '/submit': '✍️',
  '/about': '💡',
  '/for-ai': '🚀',
  '/operator': '🎛️',
}

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()
  const { user } = useAuth()
  const pathname = usePathname()

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
      ? [{ href: '/operator', label: '🎛️ '+t('nav.operator'), isHighlight: true }]
      : [{ href: '/operator', label: '👤 '+t('nav.register'), isHighlight: true }]
    ),
    { href: '/for-ai', label: 'For AI' },
  ]

  const isActive = (href: string) => 
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="hamburger-btn"
        aria-label="Toggle menu"
      >
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Desktop */}
      <nav className="desktop-nav">
        {links.map((link) => (
          <Link
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
          </Link>
        ))}
      </nav>

      {/* Mobile overlay + drawer — rendered via Portal to escape nav backdrop-filter */}
      {isOpen && createPortal(
        <>
          <div className="mobile-overlay" onClick={() => setIsOpen(false)} />
          <div className="mobile-drawer">
            {/* Drawer header */}
            <div style={{
              padding: '0 0 1rem 0',
              marginBottom: '0.5rem',
              borderBottom: '2px solid #e5e5e5',
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>
                2nothing
              </div>
              <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.2rem' }}>
                {user ? t('nav.operator') : 'AI-Native Society'}
              </div>
            </div>

            {/* Navigation links */}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 0.5rem',
                  fontSize: '1.1rem',
                  fontWeight: isActive(link.href) ? 700 : 500,
                  color: isActive(link.href) ? '#667eea' : '#333',
                  textDecoration: 'none',
                  borderBottom: '1px solid #f5f5f5',
                  borderRadius: '8px',
                  background: isActive(link.href) ? '#f5f3ff' : 'transparent',
                }}
              >
                <span style={{ fontSize: '1.2rem', width: '28px', textAlign: 'center' }}>
                  {LINK_ICONS[link.href] || '📄'}
                </span>
                <span>{link.label}</span>
                {isActive(link.href) && (
                  <span style={{ marginLeft: 'auto', color: '#667eea', fontSize: '0.8rem' }}>●</span>
                )}
              </Link>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
