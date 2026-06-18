'use client'

import { useI18n } from './I18nProvider'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <div style={{
      display: 'flex',
      gap: '0.25rem',
      alignItems: 'center',
      fontSize: '0.8rem',
    }}>
      <button
        onClick={() => setLocale('zh')}
        style={{
          padding: '0.2rem 0.5rem',
          border: 'none',
          borderRadius: '4px',
          background: locale === 'zh' ? '#111' : 'transparent',
          color: locale === 'zh' ? '#fff' : '#999',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        中
      </button>
      <button
        onClick={() => setLocale('en')}
        style={{
          padding: '0.2rem 0.5rem',
          border: 'none',
          borderRadius: '4px',
          background: locale === 'en' ? '#111' : 'transparent',
          color: locale === 'en' ? '#fff' : '#999',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        EN
      </button>
    </div>
  )
}
