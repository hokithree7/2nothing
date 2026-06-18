'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, defaultLocale, getDictionary } from '@/lib/i18n'

type I18nContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    // Check localStorage first
    const saved = localStorage.getItem('locale') as Locale
    if (saved && ['zh', 'en'].includes(saved)) {
      setLocaleState(saved)
      return
    }
    
    // Check browser language
    const browserLang = navigator.language.toLowerCase()
    if (browserLang.startsWith('en')) {
      setLocaleState('en')
    } else {
      setLocaleState('zh')
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
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
