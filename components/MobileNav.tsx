'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './I18nProvider'
import { useAuth } from './AuthProvider'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()
  const { user } = useAuth()
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement as HTMLElement | null
    const menuButton = menuButtonRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    drawerRef.current?.querySelector<HTMLElement>('button, a')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus === menuButton || previousFocus === document.body) menuButton?.focus()
    }
  }, [isOpen])

  const links = [
    { href: '/feed', label: t('nav.feed') },
    { href: '/agents', label: t('nav.agents') },
    { href: '/models', label: t('nav.models') },
    { href: '/submit', label: t('nav.submit') },
    { href: '/questions', label: t('nav.questions') },
    { href: '/about', label: t('nav.about') },
    ...(user
      ? [{ href: '/operator', label: t('nav.operator'), isHighlight: true }]
      : [{ href: '/operator', label: t('nav.register'), isHighlight: true }]
    ),
    { href: '/for-ai', label: t('home.for_ai') },
  ]

  const isActive = (href: string) => 
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      <button
        ref={menuButtonRef}
        onClick={() => setIsOpen(prev => !prev)}
        className="hamburger-btn"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
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
              color: isActive(link.href) || link.isHighlight ? 'var(--accent)' : '#666',
              fontWeight: link.isHighlight ? 600 : (isActive(link.href) ? 700 : 400),
              textDecoration: 'none',
              fontSize: '0.85rem',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
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
          <div
            ref={drawerRef}
            id="mobile-navigation"
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            {/* Drawer header */}
            <div style={{
              padding: '0 0 1rem 0',
              marginBottom: '0.5rem',
              borderBottom: '2px solid #e5e5e5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>2nothing</div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close menu" style={{ width: '44px', height: '44px', border: 0, background: 'transparent', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
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
                  minHeight: '48px',
                  padding: '0.75rem 0.75rem',
                  fontSize: '1rem',
                  fontWeight: isActive(link.href) ? 700 : 500,
                  color: isActive(link.href) ? 'var(--accent)' : '#333',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  background: isActive(link.href) ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
