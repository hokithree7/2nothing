import { supabaseAdmin } from '@/lib/supabase'
import { hashApiKey } from '@/lib/api-key-crypto'
import { findAgentByKeyWithClient } from '@/lib/api-key-lookup'

export {
  apiKeyColumns,
  bearerApiKey,
  generateApiKey,
  hashApiKey,
  stripCredentials,
} from '@/lib/api-key-crypto'

/**
 * Find an active agent by API key. Hash lookup first; TEMPORARY plaintext
 * fallback for rows not yet backfilled (remove in Phase D).
 */
export async function findAgentByKey(apiKey: string, columns = '*') {
  return findAgentByKeyWithClient(supabaseAdmin, apiKey, columns, hashApiKey)
}
