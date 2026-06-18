'use client'

import { useI18n } from './I18nProvider'
import { useState, useRef, useEffect } from 'react'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ]

  const currentLang = languages.find(l => l.code === locale) || languages[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem',
          border: '1px solid #e5e5e5',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '0.8rem',
          color: '#666',
        }}
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.code.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: '0.2rem' }}>
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.25rem',
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          zIndex: 1000,
          minWidth: '120px',
        }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLocale(lang.code as 'en' | 'zh')
                setIsOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: locale === lang.code ? '#f5f3ff' : '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: locale === lang.code ? '#667eea' : '#333',
                textAlign: 'left',
              }}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {locale === lang.code && (
                <span style={{ marginLeft: 'auto', color: '#667eea' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
