/**
 * Sanitize user input to prevent XSS
 * Only strips HTML tags and escapes dangerous characters
 * Does NOT escape quotes or slashes - API returns raw text
 */

export function sanitizeInput(input: string): string {
  if (!input) return input
  
  // Strip HTML tags (including script, style, etc.)
  let sanitized = input.replace(/<[^>]*>/g, '')
  
  // Only escape characters that could be XSS vectors in HTML context
  // Don't escape quotes or slashes - API should return raw text
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  return sanitized
}

export function sanitizeArray(arr: string[]): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map(item => sanitizeInput(String(item))).filter(Boolean)
}
