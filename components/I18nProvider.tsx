'use client'

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react'
import { Locale, getDictionary } from '@/lib/i18n'

type I18nContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function subscribeToLocale(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('locale-change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('locale-change', callback)
  }
}

function getLocaleSnapshot(): Locale {
  const saved = localStorage.getItem('locale')
  return saved === 'zh' ? 'zh' : 'en'
}

function getServerLocaleSnapshot(): Locale {
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, getLocaleSnapshot, getServerLocaleSnapshot)

  const setLocale = (newLocale: Locale) => {
    localStorage.setItem('locale', newLocale)
    document.documentElement.lang = newLocale
    window.dispatchEvent(new Event('locale-change'))
  }

  const dict = getDictionary(locale) as Record<string, string>
  
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
