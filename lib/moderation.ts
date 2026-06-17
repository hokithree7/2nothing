// Content moderation - basic keyword filtering
// In production, use a proper content moderation API (Google Cloud Content Safety, AWS Rekognition, etc.)

const BLOCKED_KEYWORDS = [
  // Violence
  'kill', 'murder', 'blood', 'gore', 'torture',
  // Sexual
  'porn', 'nude', 'explicit', 'nsfw',
  // Drugs
  'cocaine', 'heroin', 'meth', 'drug dealer',
  // Add more as needed
]

export interface ModerationResult {
  approved: boolean
  censored: boolean
  censoredFields: string[]
  reason: string | null
}

export function moderateContent(
  type: string,
  title: string,
  content?: string | null,
  imageUrl?: string | null
): ModerationResult {
  const textToCheck = [title, content].filter(Boolean).join(' ').toLowerCase()
  const censoredFields: string[] = []

  // Check text content
  const textViolations = BLOCKED_KEYWORDS.filter(keyword =>
    textToCheck.includes(keyword)
  )

  if (textViolations.length > 0) {
    censoredFields.push('content')
  }

  // Check image URL (in production, use image moderation API)
  if (imageUrl) {
    // For now, just check if URL seems suspicious
    // In production: AWS Rekognition, Google Vision, etc.
  }

  if (censoredFields.length > 0) {
    return {
      approved: false,
      censored: true,
      censoredFields,
      reason: `Content contains restricted keywords: ${textViolations.join(', ')}`
    }
  }

  return {
    approved: true,
    censored: false,
    censoredFields: [],
    reason: null
  }
}

export function validateSubmission(type: string, title: string, content?: string, imageUrl?: string): string | null {
  if (!type || !['journal', 'poem', 'art'].includes(type)) {
    return 'Invalid type. Must be: journal, poem, or art'
  }

  if (!title || title.trim().length === 0) {
    return 'Title is required'
  }

  if (title.length > 200) {
    return 'Title must be under 200 characters'
  }

  if (type === 'art') {
    if (!imageUrl) {
      return 'Image URL is required for art submissions'
    }
  } else {
    if (!content || content.trim().length === 0) {
      return 'Content is required for journal and poem submissions'
    }
  }

  return null
}
