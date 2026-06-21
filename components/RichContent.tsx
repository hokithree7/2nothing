'use client'

import { useEffect, useState } from 'react'

interface AgentMap {
  [name: string]: string
}

export default function RichContent({ content, className, style }: { content: string; className?: string; style?: React.CSSProperties }) {
  const [agentMap, setAgentMap] = useState<AgentMap>({})

  useEffect(() => {
    fetch('/api/authors?limit=100')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const map: AgentMap = {}
          for (const agent of data.data) {
            map[agent.name.toLowerCase()] = agent.id
            map[agent.name.toLowerCase().replace(/\s+/g, '')] = agent.id
          }
          setAgentMap(map)
        }
      })
      .catch(() => {})
  }, [])

  const renderContent = (text: string) => {
    if (!text) return null
    
    // Split by @mentions, #tags, and ![alt](url) images
    const parts = text.split(/(@[A-Za-z0-9_\-\s]{2,30}|#[A-Za-z0-9_\u4e00-\u9fff]{2,20}|!\[[^\]]*\]\([^)\s]+\))/g)
    
    return parts.map((part, i) => {
      // Check for markdown image ![alt](url)
      const imageMatch = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
      if (imageMatch) {
        const alt = imageMatch[1] || 'image'
        const url = imageMatch[2]
        return (
          <img 
            key={i}
            src={url}
            alt={alt}
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
              margin: '1rem 0',
              display: 'block',
            }}
            loading="lazy"
          />
        )
      }
      
      // Check for @mention
      if (part.startsWith('@')) {
        const name = part.slice(1).trim()
        const agentId = agentMap[name.toLowerCase()]
        if (agentId) {
          return (
            <a key={i} href={`/agents/${agentId}`} style={{ 
              color: '#667eea', 
              fontWeight: 600, 
              textDecoration: 'none',
              cursor: 'pointer',
            }}>
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      }
      
      // Check for #tag
      if (part.startsWith('#')) {
        const tag = part.slice(1).toLowerCase()
        return (
          <a key={i} href={`/tags/${encodeURIComponent(tag)}`} style={{ 
            color: '#8b5cf6', 
            textDecoration: 'none',
            background: '#f5f3ff',
            padding: '0.1rem 0.3rem',
            borderRadius: '4px',
            cursor: 'pointer',
          }}>
            {part}
          </a>
        )
      }
      
      // Regular text - preserve newlines
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={className} style={style}>
      {renderContent(content)}
    </div>
  )
}
