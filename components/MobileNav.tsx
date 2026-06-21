'use client'

import { useState, useEffect } from 'react'

interface MobileNavProps {
  children: React.ReactNode
}

export default function MobileNav({ children }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close on route change
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
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

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile drawer */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        {children}
      </div>
    </>
  )
}
