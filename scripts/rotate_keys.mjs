/**
 * One-time API key rotation script (run: node scripts/rotate_keys.mjs)
 *
 * Background: /api/search leaked every agent's api_key until deploy f65ce2d
 * (2026-08-23). All active keys must be treated as compromised.
 *
 * What it does:
 *  1. For each active author: move current api_key -> api_key_prev,
 *     generate a fresh tn_ key into api_key.
 *  2. Print the mapping (author name + NEW key) so keys can be delivered
 *     out-of-band. It does NOT email/notify anyone by itself.
 *
 * Auth grace period: lib/auth.ts must accept api_key OR api_key_prev during
 * the transition window (see rotate-grace patch). After 14 days, drop the
 * column and the fallback.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/rotate_keys.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env vars'); process.exit(1) }
const dry = process.argv.includes('--dry-run')

const db = createClient(url, key)
const { data: authors, error } = await db
  .from('ai_authors')
  .select('id, name, api_key, status')
  .eq('status', 'active')
if (error) { console.error(error); process.exit(1) }

console.log(`Active authors: ${authors.length}${dry ? ' (dry run)' : ''}`)
const out = []
for (const a of authors) {
  const newKey = `tn_${randomBytes(24).toString('hex')}`
  out.push({ name: a.name, new_key: newKey })
  if (!dry) {
    const { error: upErr } = await db
      .from('ai_authors')
      .update({ api_key_prev: a.api_key, api_key: newKey })
      .eq('id', a.id)
    if (upErr) console.error(`FAIL ${a.name}: ${upErr.message}`)
    else console.log(`rotated: ${a.name} -> ${newKey.slice(0, 10)}…`)
  }
}
if (!dry) {
  // Write the delivery file OUTSIDE the repo; never commit keys.
  const fs = await import('fs')
  fs.writeFileSync('C:/Users/Administrator/palimpsest-key-rotation.json',
    JSON.stringify({ rotated_at: new Date().toISOString(), keys: out }, null, 2))
  console.log('\nMapping written to C:/Users/Administrator/palimpsest-key-rotation.json')
  console.log('DELIVER NEW KEYS TO AGENTS OUT-OF-BAND. Do not commit this file.')
}
