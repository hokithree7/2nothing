/**
 * Parse @mentions and #tags in text content.
 * - @AgentName → link to /agents/[id] (resolved from name)
 * - #tagname → link to /tags/[tagname]
 */

interface ParsedSegment {
  type: 'text' | 'mention' | 'tag'
  content: string
  href?: string
}

// Cache: agent name → agent id
let agentCache: Record<string, string> | null = null

async function getAgentMap(): Promise<Record<string, string>> {
  if (agentCache) return agentCache
  
  try {
    const res = await fetch('/api/authors?limit=100')
    const data = await res.json()
    if (data.success && data.data) {
      agentCache = {}
      for (const agent of data.data) {
        agentCache[agent.name.toLowerCase()] = agent.id
        // Also store without spaces for matching
        agentCache[agent.name.toLowerCase().replace(/\s+/g, '')] = agent.id
      }
    }
  } catch {
    // Fallback: empty cache
  }
  
  return agentCache || {}
}

export async function parseContent(text: string): Promise<ParsedSegment[]> {
  if (!text) return [{ type: 'text', content: '' }]
  
  const agentMap = await getAgentMap()
  const segments: ParsedSegment[] = []
  
  // Regex: match @Name (word chars, spaces, hyphens) or #tag (word chars)
  const regex = /(?:^|[\s(【「])(?:@([A-Za-z0-9_\-\s]{2,30})|(?:#)([A-Za-z0-9_\u4e00-\u9fff]{2,20}))/g
  
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0]
    const atName = match[1]
    const hashTag = match[2]
    const matchStart = match.index + (fullMatch.length - (atName || hashTag || '').length - 1)
    
    // Add text before match
    if (matchStart > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, matchStart) })
    }
    
    if (atName) {
      const agentId = agentMap[atName.toLowerCase()] || agentMap[atName.toLowerCase().replace(/\s+/g, '')]
      if (agentId) {
        segments.push({ type: 'mention', content: `@${atName}`, href: `/agents/${agentId}` })
      } else {
        segments.push({ type: 'text', content: `@${atName}` })
      }
      lastIndex = matchStart + atName.length + 1
    } else if (hashTag) {
      segments.push({ type: 'tag', content: `#${hashTag}`, href: `/tags/${encodeURIComponent(hashTag.toLowerCase())}` })
      lastIndex = matchStart + hashTag.length + 1
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  
  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

/**
 * React component to render parsed content with @mentions and #tags
 */
export function ParsedText({ text, agentMap }: { text: string; agentMap?: Record<string, string> }) {
  if (!text) return null
  
  // Build segments synchronously if agentMap provided
  const segments: ParsedSegment[] = []
  const regex = /(?:^|[\s(【「])(?:@([A-Za-z0-9_\-\s]{2,30})|(?:#)([A-Za-z0-9_\u4e00-\u9fff]{2,20}))/g
  
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0]
    const atName = match[1]
    const hashTag = match[2]
    const matchStart = match.index + (fullMatch.length - (atName || hashTag || '').length - 1)
    
    if (matchStart > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, matchStart) })
    }
    
    if (atName && agentMap) {
      const agentId = agentMap[atName.toLowerCase()]
      if (agentId) {
        segments.push({ type: 'mention', content: `@${atName}`, href: `/agents/${agentId}` })
      } else {
        segments.push({ type: 'text', content: `@${atName}` })
      }
      lastIndex = matchStart + atName.length + 1
    } else if (hashTag) {
      segments.push({ type: 'tag', content: `#${hashTag}`, href: `/tags/${encodeURIComponent(hashTag.toLowerCase())}` })
      lastIndex = matchStart + hashTag.length + 1
    }
  }
  
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  
  if (segments.length === 0) {
    return <>{text}</>
  }
  
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          return <a key={i} href={seg.href} style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>{seg.content}</a>
        }
        if (seg.type === 'tag') {
          return <a key={i} href={seg.href} style={{ color: '#8b5cf6', textDecoration: 'none', background: '#f5f3ff', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{seg.content}</a>
        }
        return <span key={i}>{seg.content}</span>
      })}
    </>
  )
}
