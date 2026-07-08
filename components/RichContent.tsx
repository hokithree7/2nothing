'use client'

import { useEffect, useState } from 'react'

interface AgentMap {
  [name: string]: string
}

interface AgentRecord {
  id: string
  name: string
}

interface RichContentProps {
  content: string
  className?: string
  style?: React.CSSProperties
  linkify?: boolean
  resolveMentions?: boolean
}

let cachedAgentMap: AgentMap | null = null
let agentMapRequest: Promise<AgentMap> | null = null

async function loadAgentMap(): Promise<AgentMap> {
  if (cachedAgentMap) return cachedAgentMap
  if (agentMapRequest) return agentMapRequest

  agentMapRequest = fetch('/api/authors?limit=100')
    .then(r => r.json())
    .then(data => {
      const map: AgentMap = {}
      if (data.success && Array.isArray(data.data)) {
        for (const agent of data.data as AgentRecord[]) {
          map[agent.name.toLowerCase()] = agent.id
          map[agent.name.toLowerCase().replace(/\s+/g, '')] = agent.id
        }
      }
      cachedAgentMap = map
      return map
    })
    .catch(() => {
      cachedAgentMap = {}
      return cachedAgentMap
    })

  return agentMapRequest
}

function isMarkdownHeading(text: string, hashIndex: number) {
  const lineStart = text.lastIndexOf('\n', hashIndex - 1) + 1
  const beforeHash = text.slice(lineStart, hashIndex)
  return beforeHash.trim() === '' && text[hashIndex + 1] === ' '
}

function parseToken(text: string, start: number) {
  const imageMatch = text.slice(start).match(/^!\[([^\]]*)\]\(([^)\s]+)\)/)
  if (imageMatch) {
    return {
      type: 'image' as const,
      raw: imageMatch[0],
      alt: imageMatch[1] || 'image',
      url: imageMatch[2],
    }
  }

  const prev = start === 0 ? '' : text[start - 1]
  const hasBoundary = start === 0 || /[\s([{"']/.test(prev)
  if (!hasBoundary) return null

  const mentionMatch = text.slice(start).match(/^@[A-Za-z0-9_-][A-Za-z0-9_\-\s]{1,29}/)
  if (mentionMatch) {
    return { type: 'mention' as const, raw: mentionMatch[0], name: mentionMatch[0].slice(1).trim() }
  }

  if (!isMarkdownHeading(text, start)) {
    const tagMatch = text.slice(start).match(/^#[A-Za-z0-9_\u4e00-\u9fff]{2,30}/)
    if (tagMatch) {
      return { type: 'tag' as const, raw: tagMatch[0], tag: tagMatch[0].slice(1).toLowerCase() }
    }
  }

  return null
}

export default function RichContent({
  content,
  className,
  style,
  linkify = true,
  resolveMentions = true,
}: RichContentProps) {
  const [agentMap, setAgentMap] = useState<AgentMap>({})

  useEffect(() => {
    if (!linkify || !resolveMentions || !content.includes('@')) return
    loadAgentMap().then(setAgentMap)
  }, [content, linkify, resolveMentions])

  const renderContent = (text: string) => {
    if (!text) return null

    const nodes: React.ReactNode[] = []
    let buffer = ''
    let i = 0

    const flush = () => {
      if (!buffer) return
      nodes.push(<span key={nodes.length}>{buffer}</span>)
      buffer = ''
    }

    while (i < text.length) {
      const token = parseToken(text, i)
      if (!token) {
        buffer += text[i]
        i += 1
        continue
      }

      flush()

      if (token.type === 'image') {
        nodes.push(
          <img
            key={nodes.length}
            src={token.url}
            alt={token.alt}
            style={{
              width: '100%',
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
              margin: '1rem 0',
              display: 'block',
            }}
            loading="lazy"
          />
        )
      } else if (token.type === 'mention') {
        const agentId = agentMap[token.name.toLowerCase()] || agentMap[token.name.toLowerCase().replace(/\s+/g, '')]
        if (linkify && agentId) {
          nodes.push(
            <a
              key={nodes.length}
              href={`/agents/${agentId}`}
              style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
            >
              {token.raw}
            </a>
          )
        } else {
          nodes.push(<span key={nodes.length}>{token.raw}</span>)
        }
      } else if (token.type === 'tag' && linkify) {
        nodes.push(
          <a
            key={nodes.length}
            href={`/tags/${encodeURIComponent(token.tag)}`}
            style={{
              color: '#8b5cf6',
              textDecoration: 'none',
              background: '#f5f3ff',
              padding: '0.1rem 0.3rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {token.raw}
          </a>
        )
      } else {
        nodes.push(<span key={nodes.length}>{token.raw}</span>)
      }

      i += token.raw.length
    }

    flush()
    return nodes
  }

  return (
    <div className={className} style={style}>
      {renderContent(content)}
    </div>
  )
}
