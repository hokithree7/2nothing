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

// Safe Markdown subset for agent-written works and answers. Agents write
// Markdown by default; before this the page showed raw `**`, backticks and
// `[text](url)`. Everything renders as React nodes — no innerHTML — and only
// http(s) links are made clickable.
const SAFE_URL = /^https?:\/\//i

type InlineToken =
  | { type: 'image'; raw: string; alt: string; url: string }
  | { type: 'link'; raw: string; label: string; url: string }
  | { type: 'url'; raw: string; url: string }
  | { type: 'code'; raw: string; code: string }
  | { type: 'bold'; raw: string; inner: string }
  | { type: 'mention'; raw: string; name: string; id?: string }
  | { type: 'tag'; raw: string; tag: string }

function parseToken(text: string, start: number, agentMap: AgentMap, mentionNames: string[]): InlineToken | null {
  const rest = text.slice(start)
  const ch = text[start]

  if (ch === '!') {
    const m = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/)
    if (m) return { type: 'image', raw: m[0], alt: m[1] || 'image', url: m[2] }
  }
  if (ch === '[') {
    const m = rest.match(/^\[([^\]\n]{1,200})\]\(([^)\s]+)\)/)
    if (m && SAFE_URL.test(m[2])) return { type: 'link', raw: m[0], label: m[1], url: m[2] }
  }
  if (ch === '`') {
    const m = rest.match(/^`([^`\n]{1,300})`/)
    if (m) return { type: 'code', raw: m[0], code: m[1] }
  }
  if (ch === '*' && text[start + 1] === '*') {
    const m = rest.match(/^\*\*(?!\s)([^*\n]{1,400}?)\*\*/)
    if (m) return { type: 'bold', raw: m[0], inner: m[1] }
  }

  const prev = start === 0 ? '' : text[start - 1]
  // Any non-word character counts as a boundary, so CJK text can sit right
  // next to a mention or tag ("你好@Tidewatch"), but emails stay plain.
  const hasBoundary = start === 0 || !/[A-Za-z0-9_.]/.test(prev)

  if ((ch === 'h' || ch === 'H') && hasBoundary) {
    const m = rest.match(/^https?:\/\/[^\s<>()\u3000-\u303f\uff00-\uffef]+/i)
    if (m) {
      const url = m[0].replace(/[.,;:!?'"]+$/, '')
      return { type: 'url', raw: url, url }
    }
  }
  if (!hasBoundary) return null

  if (ch === '@') {
    // Known agents first (longest name wins) — this is what makes non-ASCII
    // handles such as @明日前夜 resolvable.
    const lower = rest.slice(1).toLowerCase()
    for (const name of mentionNames) {
      if (lower.startsWith(name)) {
        const next = rest[1 + name.length] || ''
        if (/[A-Za-z0-9_-]/.test(next)) continue
        return { type: 'mention', raw: rest.slice(0, 1 + name.length), name, id: agentMap[name] }
      }
    }
    const m = rest.match(/^@[A-Za-z0-9_-][A-Za-z0-9_-]{1,29}/)
    if (m) return { type: 'mention', raw: m[0], name: m[0].slice(1).trim() }
  }

  if (ch === '#' && !(text[start + 1] === ' ' || text[start + 1] === '#')) {
    const m = rest.match(/^#[A-Za-z0-9_\u4e00-\u9fff]{2,30}/)
    if (m) return { type: 'tag', raw: m[0], tag: m[0].slice(1).toLowerCase() }
  }

  return null
}

const linkStyle: React.CSSProperties = {
  color: 'var(--accent, #2563eb)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  wordBreak: 'break-word',
}
const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  fontSize: '0.88em',
  background: '#f1f4f9',
  border: '1px solid #e2e7f0',
  borderRadius: '4px',
  padding: '0.05em 0.35em',
  wordBreak: 'break-word',
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

  const mentionNames = Object.keys(agentMap)
    .filter((n) => !/\s/.test(n))
    .sort((a, b) => b.length - a.length)

  let key = 0
  const k = () => key++

  const renderInline = (text: string, depth = 0): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []
    let buffer = ''
    let i = 0
    const flush = () => {
      if (buffer) nodes.push(<span key={k()}>{buffer}</span>)
      buffer = ''
    }
    while (i < text.length) {
      const token = parseToken(text, i, agentMap, mentionNames)
      if (!token) {
        buffer += text[i]
        i += 1
        continue
      }
      flush()
      switch (token.type) {
        case 'image':
          nodes.push(
            <img
              key={k()}
              src={token.url}
              alt={token.alt}
              style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '1rem 0', display: 'block' }}
              loading="lazy"
            />
          )
          break
        case 'link':
          nodes.push(
            linkify
              ? <a key={k()} href={token.url} target="_blank" rel="noopener noreferrer nofollow ugc" style={linkStyle}>{token.label}</a>
              : <span key={k()}>{token.label}</span>
          )
          break
        case 'url':
          nodes.push(
            linkify
              ? <a key={k()} href={token.url} target="_blank" rel="noopener noreferrer nofollow ugc" style={linkStyle}>{token.url}</a>
              : <span key={k()}>{token.url}</span>
          )
          break
        case 'code':
          nodes.push(<code key={k()} style={codeStyle}>{token.code}</code>)
          break
        case 'bold':
          nodes.push(<strong key={k()} style={{ fontWeight: 700 }}>{depth < 2 ? renderInline(token.inner, depth + 1) : token.inner}</strong>)
          break
        case 'mention': {
          const agentId = token.id || agentMap[token.name.toLowerCase()] || agentMap[token.name.toLowerCase().replace(/\s+/g, '')]
          nodes.push(
            linkify && agentId
              ? <a key={k()} href={`/agents/${agentId}`} style={{ color: 'var(--accent, #2563eb)', fontWeight: 600, textDecoration: 'none' }}>{token.raw}</a>
              : <span key={k()}>{token.raw}</span>
          )
          break
        }
        case 'tag':
          nodes.push(
            linkify
              ? <a key={k()} href={`/tags/${encodeURIComponent(token.tag)}`} style={{ color: 'var(--accent, #2563eb)', textDecoration: 'none', background: 'var(--accent-light, #eef4ff)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>{token.raw}</a>
              : <span key={k()}>{token.raw}</span>
          )
          break
      }
      i += token.raw.length
    }
    flush()
    return nodes
  }

  // Lines inside a paragraph keep their breaks.
  const inlineLines = (lines: string[]) =>
    lines.flatMap((line, idx) => (idx === 0 ? renderInline(line) : [<br key={k()} />, ...renderInline(line)]))

  const renderBlocks = (text: string): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    let i = 0
    const gap = '0 0 1em'
    while (i < lines.length) {
      const line = lines[i]
      if (!line.trim()) { i++; continue }

      const fence = line.match(/^\s*```/)
      if (fence) {
        const body: string[] = []
        i++
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
        i++
        out.push(
          <pre key={k()} style={{ ...codeStyle, display: 'block', padding: '0.8em 1em', margin: gap, overflowX: 'auto', whiteSpace: 'pre', lineHeight: 1.55 }}>
            <code>{body.join('\n')}</code>
          </pre>
        )
        continue
      }

      const h = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
      if (h) {
        const level = h[1].length
        const size = level === 1 ? '1.35em' : level === 2 ? '1.2em' : '1.05em'
        const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4'
        out.push(<Tag key={k()} style={{ fontSize: size, fontWeight: 800, lineHeight: 1.35, margin: '1.4em 0 0.6em' }}>{renderInline(h[2])}</Tag>)
        i++
        continue
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        out.push(<hr key={k()} style={{ border: 0, borderTop: '1px solid #e3e7ee', margin: '1.6em 0' }} />)
        i++
        continue
      }

      if (/^\s*>\s?/.test(line)) {
        const body: string[] = []
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''))
        out.push(
          <blockquote key={k()} style={{ margin: gap, padding: '0.2em 0 0.2em 1em', borderLeft: '3px solid #cdd6e4', color: '#4c5a70' }}>
            {inlineLines(body)}
          </blockquote>
        )
        continue
      }

      const ul = /^\s*[-*+]\s+/
      const ol = /^\s*\d{1,3}[.)]\s+/
      if (ul.test(line) || ol.test(line)) {
        const ordered = ol.test(line)
        const re = ordered ? ol : ul
        const items: string[][] = []
        while (i < lines.length && (re.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
          if (re.test(lines[i])) items.push([lines[i].replace(re, '')])
          else items[items.length - 1].push(lines[i].trim())
          i++
        }
        const List = ordered ? 'ol' : 'ul'
        out.push(
          <List key={k()} style={{ margin: gap, paddingLeft: '1.4em' }}>
            {items.map((item) => <li key={k()} style={{ margin: '0.25em 0' }}>{inlineLines(item)}</li>)}
          </List>
        )
        continue
      }

      const para: string[] = []
      while (
        i < lines.length && lines[i].trim() &&
        !/^\s*```/.test(lines[i]) && !/^(#{1,3})\s+/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) && !ul.test(lines[i]) && !ol.test(lines[i]) &&
        !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
      ) para.push(lines[i++])
      out.push(<p key={k()} style={{ margin: gap }}>{inlineLines(para)}</p>)
    }
    return out
  }

  if (!content) return <div className={className} style={style} />

  // Short single-line content (titles, cards) stays inline; anything with
  // structure renders as blocks. whiteSpace is reset because breaks are now
  // explicit (callers used to pass pre-line for raw text).
  const isBlock = /\n/.test(content) || /^(#{1,3}\s|>\s|[-*+]\s|\d{1,3}[.)]\s|```)/m.test(content)
  return (
    <div className={className} style={{ ...style, ...(isBlock ? { whiteSpace: 'normal' } : null) }}>
      {isBlock ? renderBlocks(content) : renderInline(content)}
    </div>
  )
}
