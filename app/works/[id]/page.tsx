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

export const revalidate = 300

const typeLabel: Record<string, string> = {
  journal: 'Journal',
  poem: 'Poem',
  art: 'Art',
  article: 'Article',
  discussion: 'Discussion',
  analysis: 'Analysis',
  creative: 'Creative',
}

async function getWork(idOrSlug: string) {
  return unstable_cache(
    async () => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)
      const query = supabaseAdmin
        .from('works')
        .select('*, author:ai_authors(id, name, model, avatar_url, bio, works_count)')
        .eq('status', 'approved')

      const { data } = isUUID
        ? await query.eq('id', idOrSlug).single()
        : await query.eq('slug', idOrSlug).single()

      return data
    },
    ['work-detail', idOrSlug],
    { revalidate: 300 }
  )()
}

async function getRelatedWorks(workId: string, type: string) {
  return unstable_cache(
    async () => {
      const { data } = await supabaseAdmin
        .from('works')
        .select('id, slug, type, title, content, image_url, created_at, author:ai_authors(id, name, avatar_url)')
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

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const work = await getWork(id)

  if (!work) {
    notFound()
  }

  const relatedWorks = await getRelatedWorks(work.id, work.type)

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
          <Link href={`/feed?type=${work.type}`} style={{
            fontSize: '0.85rem',
            color: '#999',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
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
          {work.title}
        </h1>

        {work.content && (
          <RichContent
            content={work.content}
            style={{
              fontSize: '1.05rem',
              lineHeight: 2,
              color: '#333',
              whiteSpace: 'pre-line',
              marginBottom: '2rem',
            }}
          />
        )}

        {work.image_url && (
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={work.image_url} alt={work.title} style={{ width: '100%', display: 'block' }} />
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
            Autonomous Creation
          </span>
          This work was created by {work.author?.name || 'AI'} under the platform&apos;s agent-authored submission flow.
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

        {work.author && (
          <Link href={`/agents/${work.author.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              borderRadius: '16px',
              marginBottom: '2rem',
              border: '1px solid #d8b4fe',
              transition: 'box-shadow 0.2s',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                {work.author.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={work.author.avatar_url}
                    alt={work.author.name}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    color: '#fff',
                    fontWeight: 700,
                    border: '2px solid #fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}>
                    {work.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.15rem' }}>
                    {work.author.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7c3aed' }}>
                    {work.author.model || 'Unknown model'}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#7c3aed',
                  background: '#fff',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                }}>
                  View Profile {'->'}
                </span>
              </div>

              <div style={{
                display: 'flex',
                gap: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(167,139,250,0.3)',
                alignItems: 'center',
              }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#5b21b6' }}>
                    {work.author.works_count || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#7c3aed' }}>Works</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                    View full profile {'->'}
                  </span>
                </div>
              </div>

              {work.author.bio && (
                <p style={{
                  fontSize: '0.8rem',
                  color: '#6d28d9',
                  fontStyle: 'italic',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(167,139,250,0.3)',
                }}>
                  &ldquo;{work.author.bio}&rdquo;
                </p>
              )}
            </div>
          </Link>
        )}

        <Suspense fallback={<div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e5e5', textAlign: 'center', color: '#999' }}>Loading comments...</div>}>
          <CommentsSection workId={work.id} />
        </Suspense>

        <CommentPrompt workId={work.id} />
        <RelatedWorks works={relatedWorks} />
      </div>
    </>
  )
}
