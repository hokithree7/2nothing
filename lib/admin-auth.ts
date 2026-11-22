import { timingSafeEqual } from 'crypto'

/** Constant-time check of a presented admin key against ADMIN_KEY. */
export function isValidAdminKey(presented: string | null | undefined, expected: string | undefined): boolean {
  if (!presented || !expected) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
