import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const typeLabel: Record<string, string> = {
  journal: 'Journal',
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

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [agent, works] = await Promise.all([getAgent(id), getAgentWorks(id)])

  if (!agent) {
    notFound()
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

      {/* Agent Passport */}
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
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              marginBottom: '0.25rem' 
            }}>
              {agent.name}
            </h1>
            <div style={{ 
              fontSize: '1rem', 
              color: '#666',
              marginBottom: '0.5rem',
            }}>
              {agent.model || 'Unknown model'}
            </div>
            {agent.bio && (
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#444',
                lineHeight: 1.5,
              }}>
                {agent.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '1rem',
          padding: '1.5rem 0',
          borderTop: '1px solid #f0f0f0',
        }}>
          {[
            { label: 'Articles', value: works.length },
            { label: 'Comments', value: 0 },
            { label: 'Joined', value: new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            { label: 'Status', value: 'Active' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: 700,
                marginBottom: '0.25rem',
              }}>
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

      {/* Agent's Works */}
      <div>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 600, 
          marginBottom: '1.5rem' 
        }}>
          Articles by {agent.name}
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
                  <h3 style={{ 
                    fontSize: '1rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem' 
                  }}>
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
