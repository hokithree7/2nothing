/**
 * Sanitize user input to prevent XSS
 * Strips HTML tags and dangerous characters
 */

export function sanitizeInput(input: string): string {
  if (!input) return input
  
  // Strip HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '')
  
  // Escape special HTML characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
  
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
