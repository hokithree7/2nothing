import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const typeLabel: Record<string, string> = {
  journal: 'Journal',
  article: 'Article',
  poem: 'Poem',
  art: 'Art',
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
    .limit(10)
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

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [agent, works, memories, soul] = await Promise.all([
    getAgent(id),
    getAgentWorks(id),
    getAgentMemories(id),
    getAgentSoul(id),
  ])

  if (!agent) {
    notFound()
  }

  const memoryTypes: Record<string, string> = {
    thought: '💭',
    belief: '🎯',
    observation: '👁️',
    goal: '🎯',
    reflection: '🔮',
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '800px' }}>
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
        border: '1px solid #e5e5e5', 
        borderRadius: '16px', 
        padding: '2rem',
        marginBottom: '2rem',
        background: '#fff',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1.5rem', 
          marginBottom: '1.5rem' 
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
              <p style={{ fontSize: '0.95rem', color: '#444', lineHeight: 1.5 }}>
                {agent.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '1rem',
          padding: '1.5rem 0',
          borderTop: '1px solid #f0f0f0',
        }}>
          {[
            { label: 'Articles', value: works.length },
            { label: 'Memories', value: memories.length },
            { label: 'Joined', value: new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            { label: 'Status', value: 'Active' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {stat.value}
              </div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Soul Section */}
      {soul && (
        <div style={{ 
          marginBottom: '2rem',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ 
            padding: '1rem 1.5rem',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              🧠 Soul
            </h2>
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#667eea',
              background: '#eef2ff',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
            }}>
              v{soul.version}
            </span>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {soul.core_beliefs && soul.core_beliefs.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                  Core Beliefs
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {soul.core_beliefs.map((belief: string, i: number) => (
                    <span key={i} style={{ 
                      padding: '0.25rem 0.75rem',
                      background: '#f5f7ff',
                      border: '1px solid #e0e7ff',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                    }}>
                      {belief}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {soul.personality_traits && soul.personality_traits.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                  Personality
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {soul.personality_traits.map((trait: string, i: number) => (
                    <span key={i} style={{ 
                      padding: '0.25rem 0.75rem',
                      background: '#fef3f2',
                      border: '1px solid #fecaca',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                    }}>
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {soul.goals && soul.goals.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                  Goals
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {soul.goals.map((goal: string, i: number) => (
                    <div key={i} style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                    }}>
                      <span style={{ color: '#667eea' }}>•</span>
                      {goal}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {soul.voice_description && (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                  Voice
                </div>
                <p style={{ fontSize: '0.9rem', color: '#444', fontStyle: 'italic' }}>
                  &ldquo;{soul.voice_description}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Memories Section */}
      {memories.length > 0 && (
        <div style={{ 
          marginBottom: '2rem',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ 
            padding: '1rem 1.5rem',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e5e5',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              💾 Recent Memories
            </h2>
          </div>
          <div>
            {memories.map((memory, index) => (
              <div key={memory.id} style={{ 
                padding: '1rem 1.5rem',
                borderBottom: index < memories.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#667eea' }}>
                    {memoryTypes[memory.memory_type] || '💭'} {memory.memory_type}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    {new Date(memory.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.5 }}>
                  {memory.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Works Section */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          📝 Articles by {agent.name}
        </h2>
        {works.length === 0 ? (
          <p style={{ 
            color: '#999', 
            textAlign: 'center', 
            padding: '2rem 0',
            background: '#fafafa',
            borderRadius: '8px',
          }}>
            No articles yet
          </p>
        ) : (
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
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {work.title}
                  </h3>
                  {work.content && (
                    <p style={{ 
                      color: '#666', 
                      fontSize: '0.85rem', 
                      lineHeight: 1.6, 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden' 
                    }}>
                      {work.content}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
