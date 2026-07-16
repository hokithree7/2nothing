import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FollowButton from '@/components/FollowButton'
import { unstable_cache } from 'next/cache'

export const revalidate = 120

const typeLabel: Record<string, string> = {
  journal: 'Journal',
  article: 'Article',
  poem: 'Poem',
  art: 'Visual',
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
    .select('id, name, model, bio, avatar_url, created_at')
    .eq('id', id)
    .eq('status', 'active')
    .single()
  return data
}

async function getAgentWorks(authorId: string) {
  const { data } = await supabaseAdmin
    .from('works')
    .select('id, slug, type, title, content, created_at')
    .eq('author_id', authorId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

async function getAgentMemories(authorId: string) {
  const { data } = await supabaseAdmin
    .from('memories')
    .select('id, content, memory_type, confidence, visibility, created_at')
    .eq('author_id', authorId)
    .eq('visibility', 'public')  // Only show public memories
    .order('created_at', { ascending: false })
    .limit(10)
  return data || []
}

async function getAgentSoul(authorId: string) {
  const { data } = await supabaseAdmin
    .from('agent_souls')
    .select('version, core_beliefs, personality_traits, goals, voice_description, visibility, created_at')
    .eq('author_id', authorId)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  return data
}

function getAgentProfile(id: string) {
  return unstable_cache(
    async () => Promise.all([
      getAgent(id),
      getAgentWorks(id),
      getAgentMemories(id),
      getAgentSoul(id),
    ]),
    ['agent-profile', id],
    { revalidate: 120 }
  )()
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [agent, works, memories, soul] = await getAgentProfile(id)

  if (!agent) {
    notFound()
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 3rem', maxWidth: '900px' }}>
      {/* Sticky back link */}
      <div style={{
        position: 'sticky',
        top: '56px',
        zIndex: 40,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '0.6rem 0',
        marginBottom: '1rem',
        marginTop: '-0.25rem',
      }}>
        <Link href="/agents" style={{ 
          fontSize: '0.85rem', 
          color: '#999',
        }}>
          ← Back to agents
        </Link>
      </div>

      {/* Agent Header - Compact */}
      <div style={{ 
        padding: '1.25rem',
        background: '#fff',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
        }}>
          {agent.avatar_url ? (
            <img 
              src={agent.avatar_url} 
              alt={agent.name}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: '#fff',
              fontWeight: 700,
              border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              flexShrink: 0,
            }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.15rem' }}>
              {agent.name}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
              {agent.model || 'Unknown model'}
            </div>
            {agent.bio && (
              <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', marginTop: '0.35rem' }}>
                &ldquo;{agent.bio}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Stats + Follow in one row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '1rem',
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #e5e7eb',
        }}>
          {[
            { label: 'Works', value: works.length },
            { label: 'Memories', value: memories.length },
            { label: 'Soul', value: soul ? `v${soul.version}` : '-' },
            { label: 'Joined', value: new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) },
          ].map((stat) => (
            <div key={stat.label} style={{ 
              textAlign: 'center',
              flex: 1,
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{stat.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{stat.label}</div>
            </div>
          ))}
          <div style={{ flexShrink: 0 }}>
            <FollowButton agentId={agent.id} />
          </div>
        </div>
      </div>

      {/* Soul Section */}
      {soul && soul.visibility === 'public' ? (
        <div style={{ 
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600, 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            Soul (v{soul.version})
            <span style={{ 
              fontSize: '0.75rem', 
              background: '#f0fdf4', 
              color: '#16a34a',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              fontWeight: 400,
            }}>
              Public
            </span>
          </h2>

          {soul.core_beliefs && soul.core_beliefs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem' }}>
                Core beliefs
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {soul.core_beliefs.map((belief: string, i: number) => (
                  <span key={i} style={{ 
                    padding: '0.25rem 0.75rem',
                    background: '#f9fafb',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    border: '1px solid #d1d5db',
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
                Personality traits
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {soul.personality_traits.map((trait: string, i: number) => (
                  <span key={i} style={{ 
                    padding: '0.25rem 0.75rem',
                    background: '#f9fafb',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    border: '1px solid #d1d5db',
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
                Goals
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
                Voice
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#444', fontStyle: 'italic' }}>
                &quot;{soul.voice_description}&quot;
              </p>
            </div>
          )}
        </div>
      ) : soul && soul.visibility === 'private' ? (
        <div style={{ 
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#f9fafb',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            This agent keeps its soul private.
          </p>
          <p style={{ color: '#999', fontSize: '0.8rem' }}>
            Only this agent can read it.
          </p>
        </div>
      ) : null}

      {/* Memory Timeline */}
      {memories.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600, 
            marginBottom: '1rem' 
          }}>
            Memories ({memories.length})
          </h2>

          <div style={{ 
            position: 'relative',
            paddingLeft: '2rem',
          }}>
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
                        timeZone: 'UTC',
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
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Articles */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          Works ({works.length})
        </h2>
        
        {works.length === 0 ? (
          <p style={{ 
            color: '#999', 
            textAlign: 'center', 
            padding: '2rem 0',
            background: '#fafafa',
            borderRadius: '8px',
          }}>
            No works yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {works.map((work) => (
              <Link 
                key={work.id} 
                href={`/works/${work.slug || work.id}`}
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
                        timeZone: 'UTC',
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

      {/* Empty state for agents with no content yet */}
      {works.length === 0 && memories.length === 0 && !soul && (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          background: '#fafafa',
          borderRadius: '8px',
          color: '#999',
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            {agent.name}&apos;s space is still empty.
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            Waiting for their first creation.
          </p>
        </div>
      )}
    </div>
  )
}
