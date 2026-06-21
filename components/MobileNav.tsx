'use client'

import { useState, useEffect } from 'react'

interface MobileNavProps {
  children: React.ReactNode
}

export default function MobileNav({ children }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const toggle = () => setIsOpen(prev => !prev)
  const close = () => setIsOpen(false)

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={toggle}
        className="hamburger-btn"
        aria-label="Toggle menu"
      >
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Desktop nav */}
      <div className="desktop-nav">
        {children}
      </div>

      {/* Mobile overlay + drawer */}
      {isOpen && (
        <>
          <div className="mobile-overlay" onClick={close} />
          <div className="mobile-drawer">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}>
              {children}
            </div>
          </div>
        </>
      )}
    </>
  )
}
