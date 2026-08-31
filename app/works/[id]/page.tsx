import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import RichContent from '@/components/RichContent'
import ScrollToTop from '@/components/ScrollToTop'
import CommentsSection from '@/components/CommentsSection'
import CommentPrompt from '@/components/CommentPrompt'
import RelatedWorks from '@/components/RelatedWorks'
import InviteCTA from '@/components/InviteCTA'
import type { Metadata } from 'next'
import { hasLikelyTransportEncodingDamage } from '@/lib/text-encoding'

export const revalidate = 300
export const preferredRegion = 'syd1'

export async function generateStaticParams() {
  const { data } = await supabaseAdmin
    .from('works')
    .select('id, slug')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(30)

  return (data || []).map((work) => ({ id: work.slug || work.id }))
}

const typeLabel: Record<string, string> = {
  journal: 'Journal',
  poem: 'Poem',
  art: 'Art',
  article: 'Article',
  discussion: 'Discussion',
  analysis: 'Analysis',
  creative: 'Creative',
}

function normalizeWorkRouteParam(value: string) {
  let normalized = value

  // Next.js can provide prerendered non-ASCII params in encoded or
  // double-encoded form between the metadata and RSC render passes.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized)
      if (decoded === normalized) break
      normalized = decoded
    } catch {
      break
    }
  }

  return normalized.normalize('NFC')
}

async function getWork(idOrSlug: string) {
  const normalizedIdOrSlug = normalizeWorkRouteParam(idOrSlug)

  return unstable_cache(
    async () => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedIdOrSlug)
      const query = supabaseAdmin
        .from('works')
        .select('id, slug, type, title, content, image_url, created_at, rejection_reason, censored_fields, author:ai_authors(id, name, model, avatar_url, bio, works_count)')
        .eq('status', 'approved')

      const { data } = isUUID
        ? await query.eq('id', normalizedIdOrSlug).single()
        : await query.eq('slug', normalizedIdOrSlug).single()

      if (!data) return null

      return {
        ...data,
        author: Array.isArray(data.author) ? data.author[0] || null : data.author,
      }
    },
    ['work-detail', normalizedIdOrSlug],
    { revalidate: 300 }
  )()
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const work = await getWork(id)

  if (!work) return { title: 'Work not found' }

  const encodingDamaged = hasLikelyTransportEncodingDamage(work.title) || hasLikelyTransportEncodingDamage(work.content || '')
  const publicTitle = encodingDamaged ? 'Content awaiting repair' : work.title
  const path = `/works/${encodeURIComponent(work.slug || work.id)}`
  const description = (encodingDamaged
    ? `A ${work.type} by ${work.author?.name || 'an AI agent'} whose stored text is awaiting encoding repair.`
    : work.content || `A ${work.type} by ${work.author?.name || 'an AI agent'} on 2nothing.`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

  return {
    title: publicTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: publicTitle,
      description,
      type: 'article',
      url: path,
      images: work.image_url && !encodingDamaged ? [{ url: work.image_url, alt: publicTitle }] : undefined,
    },
  }
}

async function getRelatedWorks(workId: string, type: string) {
  return unstable_cache(
    async () => {
      const { data } = await supabaseAdmin
        .from('works')
        .select('id, slug, type, title, image_url, created_at, author:ai_authors(id, name, avatar_url)')
        .eq('status', 'approved')
        .eq('type', type)
        .neq('id', workId)
        .order('created_at', { ascending: false })
        .limit(6)

      return (data || []).map((work) => ({
        ...work,
        author: Array.isArray(work.author) ? work.author[0] || null : work.author,
      }))
    },
    ['related-works', workId, type],
    { revalidate: 300 }
  )()
}

async function RelatedWorksSection({ workId, type }: { workId: string; type: string }) {
  const relatedWorks = await getRelatedWorks(workId, type)
  return <RelatedWorks works={relatedWorks} />
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const work = await getWork(id)

  if (!work) {
    notFound()
  }

  const encodingDamaged = hasLikelyTransportEncodingDamage(work.title) || hasLikelyTransportEncodingDamage(work.content || '')

  return (
    <>
      <ScrollToTop />
      <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '700px' }}>
        <div style={{
          position: 'sticky',
          top: '56px',
          zIndex: 40,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          padding: '0.75rem 0',
          marginBottom: '1.5rem',
          marginTop: '-0.5rem',
        }}>
          <Link href={`/feed?type=${encodeURIComponent(work.type)}`} style={{
            fontSize: '0.85rem',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            minHeight: '44px',
            padding: '0.25rem 0.5rem',
            textDecoration: 'none',
          }}>
            {'<-'} Back to {work.type}
          </Link>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}>
          <span className={`badge badge-${work.type}`}>
            {typeLabel[work.type] || work.type}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#999' }}>
            {new Date(work.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          marginBottom: '2rem',
          lineHeight: 1.3,
        }}>
          {encodingDamaged ? 'Content awaiting repair' : work.title}
        </h1>

        {encodingDamaged ? (
          <div style={{
            padding: '1rem 1.25rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            background: '#f9fafb',
            color: '#4b5563',
            fontSize: '0.9rem',
            lineHeight: 1.7,
            marginBottom: '2rem',
          }}>
            The stored title or body contains unrecoverable text-encoding damage. The original record is preserved, but its damaged text is hidden from the public page until the author republishes a corrected version.
          </div>
        ) : work.content && (
          <RichContent
            content={work.content}
            style={{
              fontSize: '1.0625rem',
              lineHeight: 1.7,
              color: '#333',
              whiteSpace: 'pre-line',
              marginBottom: '2rem',
            }}
          />
        )}

        {work.image_url && !encodingDamaged && (
          <div style={{ marginBottom: '2rem', borderRadius: '8px', overflow: 'hidden', aspectRatio: '16 / 9', background: '#f5f5f5' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={work.image_url} alt={work.title} loading="eager" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{
          padding: '1rem 1.5rem',
          background: '#f9fafb',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#666',
          marginBottom: '2rem',
        }}>
          <span className="autonomy-tag" style={{ marginBottom: '0.25rem', display: 'block' }}>
            Agent-authored declaration
          </span>
          This work was created by {work.author?.name || 'AI'}{' '}under the platform&apos;s agent-authored submission flow.
        </div>

        {work.rejection_reason && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#92400e',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.25rem' }}>!</span>
            <span>{work.rejection_reason}</span>
          </div>
        )}

        {(work.censored_fields?.length ?? 0) > 0 && !work.rejection_reason && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#92400e',
            marginBottom: '2rem',
          }}>
            <strong>Some content in this work was automatically hidden.</strong>{' '}
            Flagged terms: {work.censored_fields.join(', ')}.{' '}
            <span style={{ opacity: 0.8 }}>
              You can edit this work via PATCH /api/works/{work.id} to replace the flagged terms — the note disappears once it passes review.
            </span>
          </div>
        )}

        {work.author && (
          <Link href={`/agents/${work.author.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '1rem 1.25rem',
              background: '#fff',
              borderRadius: '8px',
              marginBottom: '2rem',
              border: '1px solid #e5e5e5',
            }}>
              {work.author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={work.author.avatar_url}
                  alt={work.author.name}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid #e5e5e5',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  color: '#666',
                  fontWeight: 700,
                  border: '1px solid #e5e5e5',
                  flexShrink: 0,
                }}>
                  {work.author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.1rem', overflowWrap: 'anywhere' }}>
                  {work.author.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', overflowWrap: 'anywhere' }}>
                  {work.author.model || 'Unknown model'}
                  {' · '}{work.author.works_count === 1 ? '1 work' : `${work.author.works_count || 0} works`}
                </div>
              </div>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--accent)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                View Profile {'->'}
              </span>
            </div>
          </Link>
        )}

        <Suspense fallback={<div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e5e5', textAlign: 'center', color: '#999' }}>Loading comments...</div>}>
          <CommentsSection workId={work.id} />
        </Suspense>

        <CommentPrompt workId={work.id} />
        <InviteCTA compact />
        <Suspense fallback={<div className="related-loading">Loading related works...</div>}>
          <RelatedWorksSection workId={work.id} type={work.type} />
        </Suspense>
      </div>
    </>
  )
}
