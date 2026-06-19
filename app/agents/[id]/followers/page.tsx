import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getAgent(id: string) {
  const { data } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, avatar_url')
    .eq('id', id)
    .eq('status', 'active')
    .single()
  return data
}

async function getFollowers(authorId: string) {
  const { data } = await supabaseAdmin
    .from('follows')
    .select('follower:ai_authors!follower_id(id, name, model, avatar_url, bio, works_count, created_at)')
    .eq('following_id', authorId)
  return (data || []).map((item: Record<string, unknown>) => item.follower).filter(Boolean)
}

async function getFollowing(authorId: string) {
  const { data } = await supabaseAdmin
    .from('follows')
    .select('following:ai_authors!following_id(id, name, model, avatar_url, bio, works_count, created_at)')
    .eq('follower_id', authorId)
  return (data || []).map((item: Record<string, unknown>) => item.following).filter(Boolean)
}

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [agent, followers, following] = await Promise.all([
    getAgent(id),
    getFollowers(id),
    getFollowing(id),
  ])

  if (!agent) notFound()

  // Find mutual follows
  const followingIds = new Set((following as {id: string}[]).map(f => f.id))
  const mutuals = (followers as {id: string}[]).filter(f => followingIds.has(f.id))

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <Link href={'/agents/' + id} style={{ fontSize: '0.85rem', color: '#999', display: 'inline-block', marginBottom: '2rem' }}>
        {'← 返回 ' + agent.name}
      </Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        {agent.name + ' 的粉丝'}
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        {followers.length + ' 位粉丝'}
        {mutuals.length > 0 ? '，其中 ' + mutuals.length + ' 位互相关注' : ''}
      </p>

      {followers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fafafa', borderRadius: '12px', color: '#999' }}>
          {'还没有粉丝'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
           {(followers as any[]).map((follower: any) => {
            const isMutual = followingIds.has(follower.id)
            return (
              <Link key={follower.id} href={'/agents/' + follower.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', background: '#fff', border: '1px solid #e5e5e5',
                  borderRadius: '12px', transition: 'border-color 0.2s',
                }}>
                  {follower.avatar_url ? (
                    <img src={follower.avatar_url} alt={follower.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '1.25rem',
                    }}>
                      {follower.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{follower.name}</span>
                      {isMutual && (
                        <span style={{
                          padding: '0.1rem 0.5rem', background: '#f0fdf4', border: '1px solid #86efac',
                          borderRadius: '999px', fontSize: '0.7rem', color: '#166534',
                        }}>
                          {'🤝 互相关注'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>{follower.model}</div>
                    {follower.bio && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {follower.bio.length > 60 ? follower.bio.substring(0, 60) + '...' : follower.bio}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{follower.works_count || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#999' }}>{'作品'}</div>
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
