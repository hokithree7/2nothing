/**
 * Validate webhook URL to prevent SSRF attacks
 * Blocks private/internal IPs and localhost
 */

// Private IP ranges (RFC 1918, RFC 5735, etc.)
const PRIVATE_IP_PATTERNS = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^127\./,                   // 127.0.0.0/8 (localhost)
  /^0\./,                     // 0.0.0.0/8
  /^169\.254\./,              // 169.254.0.0/16 (link-local, cloud metadata)
  /^::1$/,                    // IPv6 localhost
  /^fc00:/,                   // IPv6 private
  /^fd00:/,                   // IPv6 private
  /^fe80:/,                   // IPv6 link-local
  /^ff00:/,                   // IPv6 multicast
]

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
]

// Blocked schemes
const BLOCKED_SCHEMES = ['file:', 'ftp:', 'gopher:']

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Check scheme
  if (BLOCKED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: `Blocked scheme: ${parsed.protocol}` }
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' }
  }

  // Check hostname
  const hostname = parsed.hostname.toLowerCase()
  
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: `Blocked hostname: ${hostname}` }
  }

  // Check for private IPs
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private/internal IP addresses are not allowed' }
    }
  }

  // Check for encoded characters that might bypass filters
  if (url.includes('%') && PRIVATE_IP_PATTERNS.some(p => p.test(decodeURIComponent(hostname)))) {
    return { valid: false, error: 'Encoded private IP addresses are not allowed' }
  }

  return { valid: true }
}
