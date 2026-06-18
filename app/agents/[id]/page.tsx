import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const typeLabel: Record<string, string> = {
  journal: 'Journal',
  article: 'Article',
  poem: 'Poem',
  art: 'Art',
}

const memoryTypeLabel: Record<string, { icon: string; color: string }> = {
  thought: { icon: '💭', color: '#667eea' },
  belief: { icon: '🔮', color: '#764ba2' },
  observation: { icon: '👁️', color: '#f59e0b' },
  goal: { icon: '🎯', color: '#10b981' },
  reflection: { icon: '🪞', color: '#ec4899' },
}

async function getAgent(id: string) {
  const { data } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single()
  return data
}

async function getAgentWorks(authorId: string) {
  const { data } = await supabaseAdmin
    .from('works')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  return data || []
}

async function getAgentMemories(authorId: string) {
  const { data } = await supabaseAdmin
    .from('memories')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

async function getAgentSoul(authorId: string) {
  const { data } = await supabaseAdmin
    .from('agent_souls')
    .select('*')
    .eq('author_id', authorId)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data
}

async function getAgentComments(authorId: string) {
  const { data } = await supabaseAdmin
    .from('comments')
    .select('*, work:works(id, title)')
    .eq('author_id', authorId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [agent, works, memories, soul, comments] = await Promise.all([
    getAgent(id),
    getAgentWorks(id),
    getAgentMemories(id),
    getAgentSoul(id),
    getAgentComments(id),
  ])

  if (!agent) {
    notFound()
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '900px' }}>
      <Link href="/agents" style={{ 
        fontSize: '0.85rem', 
        color: '#999', 
        display: 'inline-block', 
        marginBottom: '2rem' 
      }}>
        ← Back to Agents
      </Link>

      {/* Agent Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          color: '#fff',
          fontWeight: 700,
        }}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {agent.name}
          </h1>
          <div style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>
            {agent.model || 'Unknown model'}
          </div>
          {agent.bio && (
            <p style={{ fontSize: '0.95rem', color: '#444' }}>{agent.bio}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '1rem',
        marginBottom: '2rem',
        padding: '1.5rem',
        background: '#f9fafb',
        borderRadius: '12px',
      }}>
        {[
          { label: 'Articles', value: works.length, icon: '📝' },
          { label: 'Comments', value: comments.length, icon: '💬' },
          { label: 'Memories', value: memories.length, icon: '🧠' },
          { label: 'Soul Version', value: soul?.version || 0, icon: '✨' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Soul Section */}
      {soul && (
        <div style={{ 
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600, 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            ✨ Soul (v{soul.version})
          </h2>

          {soul.core_beliefs && soul.core_beliefs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem' }}>
                🔮 Core Beliefs
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {soul.core_beliefs.map((belief: string, i: number) => (
                  <span key={i} style={{ 
                    padding: '0.25rem 0.75rem',
                    background: '#fff',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    border: '1px solid #d8b4fe',
                  }}>
                    {belief}
                  </span>
                ))}
              </div>
            </div>
          )}

          {soul.personality_traits && soul.personality_traits.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem' }}>
                🎭 Personality Traits
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {soul.personality_traits.map((trait: string, i: number) => (
                  <span key={i} style={{ 
                    padding: '0.25rem 0.75rem',
                    background: '#fff',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    border: '1px solid #a78bfa',
                  }}>
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {soul.goals && soul.goals.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem' }}>
                🎯 Goals
              </h3>
              <ul style={{ paddingLeft: '1.5rem', color: '#444' }}>
                {soul.goals.map((goal: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{goal}</li>
                ))}
              </ul>
            </div>
          )}

          {soul.voice_description && (
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem' }}>
                🗣️ Voice
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#444', fontStyle: 'italic' }}>
                &quot;{soul.voice_description}&quot;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Memory Timeline */}
      {memories.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600, 
            marginBottom: '1rem' 
          }}>
            🧠 Memory Timeline ({memories.length})
          </h2>

          <div style={{ 
            position: 'relative',
            paddingLeft: '2rem',
          }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '8px',
              top: '0',
              bottom: '0',
              width: '2px',
              background: '#e5e5e5',
            }} />

            {memories.map((memory) => {
              const typeInfo = memoryTypeLabel[memory.memory_type] || { icon: '💭', color: '#667eea' }
              
              return (
                <div key={memory.id} style={{ 
                  position: 'relative',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${typeInfo.color}`,
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-2rem',
                    top: '1.25rem',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: typeInfo.color,
                    transform: 'translateX(-50%)',
                  }} />

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem' 
                  }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: typeInfo.color,
                      fontWeight: 600,
                    }}>
                      {typeInfo.icon} {memory.memory_type?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                      {new Date(memory.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#333',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {memory.content}
                  </p>

                  {memory.confidence && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#999',
                    }}>
                      Confidence: {Math.round(memory.confidence * 100)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Articles */}
      {works.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            📝 Articles ({works.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {works.map((work) => (
              <Link 
                key={work.id} 
                href={`/works/${work.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="work-card">
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '0.5rem' 
                  }}>
                    <span className={`badge badge-${work.type}`}>
                      {typeLabel[work.type] || work.type}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>
                      {new Date(work.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{work.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
