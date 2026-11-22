import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error Node's native TypeScript test loader requires .ts here.
import { apiKeyColumns, generateApiKey, hashApiKey, stripCredentials } from './api-key-crypto.ts'
// @ts-expect-error Node's native TypeScript test loader requires .ts here.
import { findAgentByKeyWithClient, type ApiKeyLookupClient } from './api-key-lookup.ts'

type Result = { data: Record<string, unknown> | null; error: { code?: string } | null }

function fakeClient(results: Result[]) {
  const calls: Array<{ column: string; value: string | null; op: 'eq' | 'is' }> = []
  const client = {
    from() {
      const query = {
        select() { return query },
        eq(column: string, value: string) {
          calls.push({ column, value, op: 'eq' })
          return query
        },
        is(column: string, value: null) {
          calls.push({ column, value, op: 'is' })
          return query
        },
        async maybeSingle() {
          const result = results.shift()
          if (!result) throw new Error('unexpected query')
          return result
        },
      }
      return query
    },
  }
  return { client: client as unknown as ApiKeyLookupClient, calls }
}

test('hashApiKey matches SQL encode(digest(key, sha256), hex)', () => {
  // SELECT encode(extensions.digest('tn_test', 'sha256'), 'hex');
  assert.equal(hashApiKey('tn_test'), '9bfc4598901b34171886c8c0f83dd82121efa79eb2ad1e474b2b5e2cf53629b4')
  assert.match(hashApiKey('tn_x'), /^[0-9a-f]{64}$/)
})

test('distinct keys hash differently', () => {
  assert.notEqual(hashApiKey('tn_a'), hashApiKey('tn_b'))
})

test('generateApiKey and apiKeyColumns use the canonical format and hash', () => {
  const key = generateApiKey()
  assert.match(key, /^tn_[0-9a-f]{48}$/)
  assert.deepEqual(apiKeyColumns('tn_test'), { api_key: 'tn_test', api_key_hash: hashApiKey('tn_test') })
})

test('stripCredentials removes both stored credential representations', () => {
  assert.deepEqual(stripCredentials({ id: 'a1', api_key: 'tn_secret', api_key_hash: 'hash' }), { id: 'a1' })
})

test('lookup returns a hash match without a plaintext query', async () => {
  const { client, calls } = fakeClient([{ data: { id: 'a1' }, error: null }])
  assert.deepEqual(await findAgentByKeyWithClient(client, 'tn_test', 'id', hashApiKey), { id: 'a1' })
  assert.equal(calls.filter((call) => call.column === 'api_key').length, 0)
})

test('lookup allows plaintext fallback only for a null hash after Phase A', async () => {
  const { client, calls } = fakeClient([
    { data: null, error: null },
    { data: { id: 'legacy' }, error: null },
  ])
  assert.deepEqual(await findAgentByKeyWithClient(client, 'tn_test', 'id', hashApiKey), { id: 'legacy' })
  assert.deepEqual(calls.find((call) => call.op === 'is'), { column: 'api_key_hash', value: null, op: 'is' })
})

test('lookup permits unrestricted plaintext fallback only when the hash column is absent', async () => {
  const { client, calls } = fakeClient([
    { data: null, error: { code: '42703' } },
    { data: { id: 'pre-migration' }, error: null },
  ])
  assert.deepEqual(await findAgentByKeyWithClient(client, 'tn_test', 'id', hashApiKey), { id: 'pre-migration' })
  assert.equal(calls.some((call) => call.op === 'is'), false)
})

test('lookup fails closed for a non-schema hash lookup error', async () => {
  const { client, calls } = fakeClient([{ data: null, error: { code: '42501' } }])
  assert.equal(await findAgentByKeyWithClient(client, 'tn_test', 'id', hashApiKey), null)
  assert.equal(calls.filter((call) => call.column === 'api_key').length, 0)
})
