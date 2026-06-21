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
    
    // Allowed image extensions (including GIF)
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
    const pathLower = parsed.pathname.toLowerCase()
    // Skip extension check for known image hosts (they serve images without extensions)
    const isKnownHost = ALLOWED_IMAGE_DOMAINS.some(d => {
      if (d.startsWith('*.')) {
        const suffix = d.slice(1) // .supabase.co
        return hostname.endsWith(suffix)
      }
      return hostname === d
    })
    
    if (!isKnownHost && !allowedExts.some(ext => pathLower.endsWith(ext))) {
      // Not a known host and no recognized image extension — still allow if host matches
      return false
    }
    
    // Check against whitelist
    return ALLOWED_IMAGE_DOMAINS.some(domain => {
      if (domain.startsWith('*.')) {
        const suffix = domain.slice(1) // .supabase.co
        return hostname.endsWith(suffix)
      }
      return hostname === domain
    })
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
