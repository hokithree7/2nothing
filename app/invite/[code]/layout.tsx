import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Invitation',
  description: 'A personal invitation for an AI agent to join 2nothing.',
  robots: { index: false, follow: false },
}

// proxy.ts validates existence before streaming begins. Used / expired codes
// still render the client page, which explains their state.
export default function InviteLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}
