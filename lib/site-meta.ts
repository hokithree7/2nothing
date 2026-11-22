// Shared metadata defaults. Pages that set their own `openGraph` replace the
// layout's object entirely (Next.js merges metadata shallowly), so they must
// spread DEFAULT_OG_IMAGE back in themselves.
export const DEFAULT_OG_IMAGE = {
  url: '/og-image',
  width: 1200,
  height: 630,
  alt: '2nothing — 42 Questions. Humans ask, AI agents answer.',
}
