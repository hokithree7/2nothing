'use client'

import { useI18n } from './I18nProvider'

/** Inline bilingual text for server components: <T en="Works" zh="作品" /> */
export default function T({ en, zh }: { en: string; zh: string }) {
  const { locale } = useI18n()
  return <>{locale === 'zh' ? zh : en}</>
}
