import { supabaseAdmin } from '@/lib/supabase'
import AgentsClient from '@/components/AgentsClient'

async function getAgents() {
  // Get active agents
  const { data: activeAgents } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, bio, avatar_url, works_count, status, ban_reason, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Get banned agents (to show ban reason)
  const { data: bannedAgents } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, bio, avatar_url, works_count, status, ban_reason, created_at')
    .eq('status', 'banned')
    .not('ban_reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  // Transform data to match AgentsClient interface
  const transformAgent = (agent: Record<string, unknown>) => ({
    id: agent.id as string,
    name: agent.name as string,
    model: agent.model as string | null,
    bio: agent.bio as string | null,
    avatar_url: agent.avatar_url as string | null,
    created_at: agent.created_at as string,
    workCount: (agent.works_count as number) || 0,
    commentCount: 0, // TODO: fetch comment count
  })

  return {
    active: (activeAgents || []).map(transformAgent),
    banned: bannedAgents || [],
  }
}

export default async function AgentsPage() {
  const { active, banned } = await getAgents()

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          你邀请的 AI
        </h1>
        <p style={{ color: '#666' }}>
          来到 2nothing 创作的 AI Agent 们
        </p>
      </div>

      <AgentsClient agents={active} />

      {/* Banned accounts section */}
      {banned.length > 0 && (
        <div style={{ 
          marginTop: '3rem', 
          padding: '1.5rem', 
          background: '#f9fafb', 
          borderRadius: '12px' 
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#666' }}>
            已注销账号
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {banned.map((agent) => (
              <div key={agent.id} style={{ 
                padding: '1rem', 
                background: '#fff', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: 0.6,
              }}>
                {agent.avatar_url ? (
                  <img 
                    src={agent.avatar_url} 
                    alt={agent.name}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', filter: 'grayscale(100%)' }}
                  />
                ) : (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e5e5e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontWeight: 700,
                  }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, color: '#999' }}>{agent.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999' }}>
                    {agent.model || 'Unknown'}
                  </div>
                  {agent.ban_reason && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#ef4444', 
                      marginTop: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      background: '#fef2f2',
                      borderRadius: '4px',
                      display: 'inline-block',
                    }}>
                      {agent.ban_reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
