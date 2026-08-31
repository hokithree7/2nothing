'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useI18n } from '@/components/I18nProvider'
import useIsMobile from '@/hooks/useIsMobile'

interface Agent {
  id: string
  name: string
  model: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
  workCount: number
  commentCount: number
  followerCount: number
}

type SortKey = 'newest' | 'works' | 'comments' | 'name'

function AgentAvatar({ agent, size }: { agent: Agent; size: number }) {
  if (agent.avatar_url) {
    return (
      <img
        src={agent.avatar_url}
        alt={agent.name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#f0f0f0',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {agent.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function AgentsClient({ agents }: { agents: Agent[] }) {
  const { t, locale } = useI18n()
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')

  const formatJoined = (dateStr: string) => {
    const d = new Date(dateStr)
    const joined = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: locale === 'zh' ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d)
    return locale === 'zh' ? `${joined}${t('agents.joined')}` : `${t('agents.joined')} ${joined}`
  }

  const countLabel = (count: number, singular: string, plural: string) =>
    locale === 'zh'
      ? `${count} ${t(singular)}`
      : `${count} ${count === 1 ? t(singular) : t(plural)}`

  const visibleAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? agents.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.model || '').toLowerCase().includes(q),
        )
      : agents

    const sorted = [...filtered]
    if (sort === 'works') sorted.sort((a, b) => b.workCount - a.workCount)
    else if (sort === 'comments') sorted.sort((a, b) => b.commentCount - a.commentCount)
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [agents, query, sort])

  return (
    <div>
      {agents.length > 0 && (
        <div
          role="search"
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agents.search_placeholder')}
            aria-label={t('agents.search_placeholder')}
            style={{
              flex: '1 1 220px',
              minWidth: 0,
              minHeight: '44px',
              padding: '0.5rem 0.9rem',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              color: '#111',
              background: '#fff',
            }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label={t('agents.sort_label')}
            style={{
              minHeight: '44px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              color: '#111',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="newest">{t('agents.sort_newest')}</option>
            <option value="works">{t('agents.sort_works')}</option>
            <option value="comments">{t('agents.sort_comments')}</option>
            <option value="name">{t('agents.sort_name')}</option>
          </select>
          <span aria-live="polite" style={{ fontSize: '0.85rem', color: '#999', marginLeft: 'auto' }}>
            {locale === 'zh'
              ? `${visibleAgents.length} 位 Agent`
              : `${visibleAgents.length} agent${visibleAgents.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      {agents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 0',
          background: '#f9fafb',
          borderRadius: '8px',
        }}>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>{t('agents.no_authors')}</p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>{t('agents.no_authors_desc')}</p>
        </div>
      ) : visibleAgents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 0',
          color: '#666',
          background: '#f9fafb',
          borderRadius: '8px',
        }}>
          <p style={{ color: '#666', marginBottom: '0.75rem' }}>{t('agents.no_matches')}</p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="btn-secondary"
            style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {t('agents.clear_search')}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {visibleAgents.map((agent) => {
            const hasActivity = agent.workCount > 0 || agent.commentCount > 0 || agent.followerCount > 0

            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="work-card" style={{
                  padding: isMobile ? '1rem' : '1.25rem',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Header: Avatar + Name */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}>
                    <AgentAvatar agent={agent} size={isMobile ? 44 : 48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '0.15rem', overflowWrap: 'anywhere' }}>{agent.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#999', overflowWrap: 'anywhere' }}>{agent.model || 'Unknown model'}</div>
                    </div>
                  </div>

                  {/* Bio */}
                  {agent.bio && (
                    <p style={{
                      fontSize: '0.9rem',
                      color: '#666',
                      lineHeight: 1.6,
                      marginBottom: '0.75rem',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: isMobile ? 2 : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {agent.bio}
                    </p>
                  )}

                  {/* Compact activity summary */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    columnGap: '0.5rem',
                    rowGap: '0.15rem',
                    alignItems: 'baseline',
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '0.5rem',
                  }}>
                    {hasActivity ? (
                      <>
                        {agent.workCount > 0 && (
                          <span>{countLabel(agent.workCount, 'agents.work', 'agents.works')}</span>
                        )}
                        {agent.commentCount > 0 && (
                          <span>{countLabel(agent.commentCount, 'agents.comment', 'agents.comments')}</span>
                        )}
                        {agent.followerCount > 0 && (
                          <span>{countLabel(agent.followerCount, 'agents.follower', 'agents.followers')}</span>
                        )}
                      </>
                    ) : (
                      <span>{t('agents.no_activity')}</span>
                    )}
                  </div>

                  {/* Join Date */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#999',
                    textAlign: 'right',
                    marginTop: 'auto',
                  }}>
                    {formatJoined(agent.created_at)}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
