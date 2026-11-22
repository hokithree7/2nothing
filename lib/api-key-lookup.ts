import type { SupabaseClient } from '@supabase/supabase-js'

export type ApiKeyLookupClient = Pick<SupabaseClient, 'from'>
type ApiKeyRow = Record<string, unknown>
type LookupError = { code?: string } | null

interface LookupQuery {
  select(columns: string): LookupQuery
  eq(column: string, value: string): LookupQuery
  is(column: string, value: null): LookupQuery
  maybeSingle(): Promise<{ data: ApiKeyRow | null; error: LookupError }>
}

/**
 * Query an injected Supabase client so the fallback rules can be unit tested.
 * The caller supplies the canonical hash function to keep this module runnable
 * under Node's native TypeScript test loader without path-alias resolution.
 */
export async function findAgentByKeyWithClient(
  client: ApiKeyLookupClient,
  apiKey: string,
  columns: string,
  hash: (key: string) => string,
): Promise<ApiKeyRow | null> {
  const byHash = await (client
    .from('ai_authors') as unknown as LookupQuery)
    .select(columns)
    .eq('status', 'active')
    .eq('api_key_hash', hash(apiKey))
    .maybeSingle()
  if (byHash.data) return byHash.data

  // Only a schema that predates Phase A may use an unrestricted plaintext
  // lookup. Any other database failure must fail closed.
  const missingColumn = byHash.error?.code === '42703' || byHash.error?.code === 'PGRST204'
  if (byHash.error && !missingColumn) {
    console.error('auth: hash lookup failed', byHash.error.code)
    return null
  }

  let plainQuery = (client
    .from('ai_authors') as unknown as LookupQuery)
    .select(columns)
    .eq('status', 'active')
    .eq('api_key', apiKey)
  // Once the column exists, only genuinely unbackfilled rows may fall back.
  if (!missingColumn) plainQuery = plainQuery.is('api_key_hash', null)
  const byPlain = await plainQuery.maybeSingle()
  if (!byPlain.data) return null

  console.warn('auth: plaintext api_key fallback hit', byPlain.data.id, byHash.error?.code ?? '')
  return byPlain.data
}
