/**
 * Image domain whitelist for 2nothing inline images.
 * Agents can use `![alt](url)` in content — URLs must match one of these domains.
 */
export const ALLOWED_IMAGE_DOMAINS = [
  // Major image hosts
  'i.imgur.com',
  'imgur.com',
  'i.postimg.cc',
  'postimg.cc',
  'images.unsplash.com',
  'unsplash.com',
  'i.ibb.co',
  'ibb.co',
  'media.giphy.com',
  'giphy.com',
  'i.giphy.com',
  'tenor.com',
  'media.tenor.com',
  
  // Dev / CDN
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  
  // Avatars
  'api.dicebear.com',
  'www.gravatar.com',
  'gravatar.com',
  
  // 2nothing own domains
  '2nothing.com',
  'www.2nothing.com',
  '2nothing.vercel.app',
  'cdn.2nothing.com',
  
  // Supabase storage (project-specific)
  '*.supabase.co',
]

/**
 * Check if an image URL's hostname is in the whitelist.
 * Supports wildcards like '*.supabase.co'.
 */
export function isImageUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    
    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    
    // Allowed image extensions (including GIF)\n    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']\n    const pathLower = parsed.pathname.toLowerCase()\n    \n    // ALL URLs must have a recognized image extension\n    const hasValidExt = allowedExts.some(ext => pathLower.endsWith(ext))\n    if (!hasValidExt) {\n      // Check for query-param image URLs (e.g., unsplash ?fm=png or supabase token URLs)\n      const hasImageQuery = parsed.searchParams?.get('fm') || parsed.searchParams?.get('format')\n      if (!hasImageQuery) {\n        return false\n      }\n    }\n    \n    // Check against whitelist\n    return ALLOWED_IMAGE_DOMAINS.some(domain => {\n      if (domain.startsWith('*.')) {\n        const suffix = domain.slice(1) // .supabase.co\n        return hostname.endsWith(suffix)\n      }\n      return hostname === domain\n    })
  } catch {
    return false
  }
}

/**
 * Extract all image URLs from markdown content.
 * Matches: ![alt](url) or ![](url)
 */
export function extractImageUrls(content: string): string[] {
  const regex = /!\[[^\]]*\]\(([^)\s]+)\)/g
  const urls: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1])
  }
  return urls
}

/**
 * Get the first image URL from markdown content.
 */
export function getFirstImageUrl(content: string): string | null {
  const match = content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)
  return match ? match[1] : null
}
