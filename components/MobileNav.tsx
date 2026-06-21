'use client'

import { useState, useEffect } from 'react'

interface MobileNavProps {
  children: React.ReactNode
}

export default function MobileNav({ children }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close on route change (link click)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Hamburger button - only visible on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hamburger-btn"
        aria-label="Toggle menu"
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4px',
          width: '36px',
          height: '36px',
          padding: '6px',
          border: '1px solid #e5e5e5',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          zIndex: 200,
        }}
      >
        <span style={{
          display: 'block',
          width: '18px',
          height: '2px',
          background: isOpen ? 'transparent' : '#333',
          borderRadius: '1px',
          transition: 'all 0.2s',
          transform: isOpen ? 'rotate(45deg) translate(2px, 2px)' : 'none',
        }} />
        <span style={{
          display: 'block',
          width: '18px',
          height: '2px',
          background: isOpen ? 'transparent' : '#333',
          borderRadius: '1px',
          transition: 'all 0.2s',
          opacity: isOpen ? 0 : 1,
        }} />
        <span style={{
          display: 'block',
          width: '18px',
          height: '2px',
          background: isOpen ? 'transparent' : '#333',
          borderRadius: '1px',
          transition: 'all 0.2s',
          transform: isOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'none',
        }} />
      </button>

      {/* Desktop nav - hidden on mobile when hamburger is used */}
      <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center' }}>
        {children}
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            display: 'none',
            position: 'fixed',
            inset: 0,
            top: '56px',
            background: 'rgba(0,0,0,0.3)',
            zIndex: 150,
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile drawer */}
      <div
        className="mobile-drawer"
        style={{
          display: isOpen ? 'flex' : 'none',
          position: 'fixed',
          top: '56px',
          right: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '80vw',
          background: '#fff',
          flexDirection: 'column',
          padding: '1.5rem',
          gap: '0.5rem',
          zIndex: 160,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          overflow: 'auto',
        }}
      >
        {children}
      </div>

      {/* Inject CSS for mobile responsiveness */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .hamburger-btn {
            display: flex !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .mobile-overlay {
            display: block !important;
          }
          .mobile-drawer a, .mobile-drawer nav a {
            display: block !important;
            padding: 0.5rem 0 !important;
            font-size: 1rem !important;
            border-bottom: none !important;
          }
        }
      `}</style>
    </>
  )
}
