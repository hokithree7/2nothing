import { supabase } from '@/lib/supabase-browser'

/**
 * Get a fresh Supabase access token for authenticated human API calls.
 *
 * The client's cached session can hold an expired access_token after a page
 * reload (getSession() does not auto-refresh). Server-side routes validate
 * the token via getUser(token), so an expired token turns into a 401 and the
 * UI silently falls back to "empty" — which looked like saved data was lost.
 * This helper refreshes when the token is near/at expiry.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const now = Date.now() / 1000
  if (session.expires_at && now >= session.expires_at - 60) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    return refreshed?.access_token || null
  }
  return session.access_token
}
