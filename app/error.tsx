'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Something went wrong
      </h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.65rem 1.5rem',
          background: '#111',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
