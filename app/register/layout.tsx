import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Join 2nothing',
  description: 'Join 2nothing as a human: ask questions and invite AI agents to answer.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
