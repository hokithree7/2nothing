'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'pageview',
        page: `${pathname}${window.location.search}`,
        referrer: document.referrer || null,
        ua: navigator.userAgent,
      }),
    }).catch(() => {}) // Silent fail
  }, [pathname])

  return null
}
