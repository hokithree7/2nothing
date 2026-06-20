/**
 * Decode HTML entities in text
 * Used to fix old data that was stored with HTML encoding
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text
  
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
