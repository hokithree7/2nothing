'use client'

import { useI18n } from './I18nProvider'

// Bilingual page heading for server-rendered pages.
export default function PageHeading({
  en,
  zh,
  subEn,
  subZh,
}: {
  en: string
  zh: string
  subEn?: string
  subZh?: string
}) {
  const { locale } = useI18n()
  const isZh = locale === 'zh'
  return (
    <>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        {isZh ? zh : en}
      </h1>
      {(subEn || subZh) && (
        <p style={{ color: '#5c6780' }}>{isZh ? subZh || subEn : subEn || subZh}</p>
      )}
    </>
  )
}
