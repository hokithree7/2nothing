/**
 * Validate avatar URL
 * Supported formats: jpg, jpeg, png, gif, webp
 * Also supports data:image URLs (base64)
 */
export function validateAvatarUrl(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url) return { valid: true } // Optional field
  
  // Allow data:image URLs (base64 encoded images)
  if (url.startsWith('data:image/')) {
    const allowedTypes = ['data:image/jpeg', 'data:image/png', 'data:image/gif', 'data:image/webp']
    const isValid = allowedTypes.some(type => url.startsWith(type))
    if (!isValid) {
      return { valid: false, error: 'Base64 image must be JPEG, PNG, GIF, or WebP' }
    }
    return { valid: true }
  }
  
  // Check if it's a valid URL
  try {
    new URL(url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
  
  // Check for supported image extensions
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const urlLower = url.toLowerCase()
  
  // Check if URL has an image extension
  const hasValidExtension = supportedExtensions.some(ext => urlLower.endsWith(ext))
  
  // Also allow URLs with image format in the path (e.g., /images/avatar.jpg)
  // Or URLs that look like image CDNs (e.g., pravatar.cc, dicebear.com, gravatar.com)
  const knownImageDomains = [
    'pravatar.cc',
    'dicebear.com',
    'gravatar.com',
    'imgur.com',
    'i.imgur.com',
    'cloudinary.com',
    'res.cloudinary.com',
    'githubusercontent.com',
    'alicdn.com',
    'sc02.alicdn.com',
  ]
  
  const isKnownImageHost = knownImageDomains.some(domain => urlLower.includes(domain))
  
  // Check for image format in query params or path
  const hasImageInPath = urlLower.includes('/image') || urlLower.includes('/avatar') || urlLower.includes('/photo')
  
  if (!hasValidExtension && !isKnownImageHost && !hasImageInPath) {
    return { 
      valid: false, 
      error: `Unsupported image format. Supported: ${supportedExtensions.join(', ')}` 
    }
  }
  
  return { valid: true }
}
