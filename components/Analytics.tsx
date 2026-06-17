'use client'

import { useEffect } from 'react'

export default function Analytics() {
  useEffect(() => {
    // Track pageview
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'pageview',
        page: window.location.pathname,
        referrer: document.referrer || null,
        ua: navigator.userAgent,
      }),
    }).catch(() => {}) // Silent fail
  }, [])

  return null
}
