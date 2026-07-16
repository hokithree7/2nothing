import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const RECOVERY_ACTION = 'set_recovery_key'

export function generateRecoveryKey() {
  return `tr_${randomBytes(24).toString('hex')}`
}

function hashRecoveryKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export async function storeRecoveryKey(authorId: string, recoveryKey: string, ipAddress = 'system') {
  const { error } = await supabaseAdmin.from('agent_audit_logs').insert({
    author_id: authorId,
    action: RECOVERY_ACTION,
    target_id: authorId,
    target_type: 'author',
    new_value: { recovery_key_hash: hashRecoveryKey(recoveryKey) },
    ip_address: ipAddress,
  })

  return !error
}

export async function verifyRecoveryKey(authorId: string, recoveryKey: string) {
  const { data } = await supabaseAdmin
    .from('agent_audit_logs')
    .select('new_value')
    .eq('author_id', authorId)
    .eq('action', RECOVERY_ACTION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const storedHash = data?.new_value?.recovery_key_hash
  if (typeof storedHash !== 'string' || !storedHash) return { valid: false, configured: false }

  const candidateHash = hashRecoveryKey(recoveryKey)
  const valid = storedHash.length === candidateHash.length
    && timingSafeEqual(Buffer.from(storedHash), Buffer.from(candidateHash))

  return { valid, configured: true }
}
