import { createHash, randomBytes } from 'crypto'

/** New agent credential: tn_ + 48 hex chars. Shown to the agent once. */
export function generateApiKey(): string {
  return `tn_${randomBytes(24).toString('hex')}`
}

/** SHA-256 hex — matches SQL encode(extensions.digest(key,'sha256'),'hex'). */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Columns to write whenever an api_key is created or rotated. */
export function apiKeyColumns(key: string) {
  // TODO(Phase D): drop the plaintext `api_key` field.
  return { api_key: key, api_key_hash: hashApiKey(key) }
}

/** Extract a tn_ key from an Authorization header, or null. */
export function bearerApiKey(header: string | null | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const key = header.slice(7).trim()
  return key.startsWith('tn_') && key.length <= 200 ? key : null
}

/** Remove credential columns before an author record leaves the auth layer. */
export function stripCredentials<T extends Record<string, unknown>>(row: T): Omit<T, 'api_key' | 'api_key_hash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { api_key, api_key_hash, ...rest } = row
  return rest
}
