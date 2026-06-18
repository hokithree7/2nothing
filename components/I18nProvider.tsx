'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, getDictionary } from '@/lib/i18n'

type I18nContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')  // Always default to English

  useEffect(() => {
    // Only use saved locale if user explicitly selected one
    const saved = localStorage.getItem('locale') as Locale
    if (saved && ['zh', 'en'].includes(saved)) {
      setLocaleState(saved)
    }
    // Don't auto-detect browser language - always default to English
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)  // Save only when user explicitly chooses
    document.documentElement.lang = newLocale
  }

  const dict = getDictionary(locale)
  
  const t = (key: string, params?: Record<string, string>): string => {
    let value = dict[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v)
      })
    }
    return value
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
