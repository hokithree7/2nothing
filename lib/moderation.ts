// Content moderation - keyword filtering with normalization
// In production, consider adding a proper content moderation API (OpenAI Moderation, Perspective API)

const BLOCKED_KEYWORDS = [
  // Violence
  'kill', 'murder', 'blood', 'gore', 'torture', 'violence', 'weapon', 'attack',
  // Sexual
  'porn', 'nude', 'naked', 'explicit', 'nsfw', 'sexual', 'erotic',
  // Drugs
  'cocaine', 'heroin', 'methamphetamine', 'drug dealer', 'fentanyl',
  // Hate
  'nazi', 'terrorist', 'slur',
  // Self-harm
  'suicide', 'self-harm',
]

// Leetspeak / common substitutions
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '+': 't',
}

// Zero-width and invisible Unicode characters to strip
const INVISIBLE_RE = /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E]/g

// Common homoglyphs → ASCII
const HOMOGLYPH_MAP: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', // Cyrillic
  'ɑ': 'a', 'ε': 'e', 'ι': 'i', 'ο': 'o', 'ν': 'v', 'κ': 'k', // Greek
  '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g', // Math bold
  '𝚔': 'k', '𝚒': 'i', '𝚕': 'l', // Math mono
}

export interface ModerationResult {
  approved: boolean
  censored: boolean
  censoredFields: string[]
  reason: string | null
}

function normalizeText(text: string): string {
  let normalized = text.toLowerCase()

  // Strip invisible / zero-width characters
  normalized = normalized.replace(INVISIBLE_RE, '')

  // Normalize homoglyphs
  normalized = normalized.split('').map(ch => HOMOGLYPH_MAP[ch] || ch).join('')

  // Normalize leetspeak
  normalized = normalized.split('').map(ch => LEET_MAP[ch] || ch).join('')

  // Remove diacritics (é → e, ñ → n, etc.)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Collapse repeated spaces and punctuation separators (k.i.l.l → kill, k i l l → kill)
  normalized = normalized.replace(/[.\-_\s]+/g, '')

  return normalized
}

function findWholeWord(text: string, word: string): boolean {
  const regex = new RegExp(`\\b${word}\\b`, 'i')
  return regex.test(text)
}

export function moderateContent(
  type: string,
  title: string,
  content?: string | null,
  imageUrl?: string | null
): ModerationResult {
  const rawText = [title, content].filter(Boolean).join(' ').toLowerCase()
  const censoredWords: string[] = []

  for (const keyword of BLOCKED_KEYWORDS) {
    // Word-boundary match on raw text — avoids false positives like "skill" for "kill"
    if (findWholeWord(rawText, keyword)) {
      censoredWords.push(keyword)
    }
  }

  // Check image URL — reject suspicious patterns
  if (imageUrl) {
    const lowerUrl = imageUrl.toLowerCase()
    const suspiciousPatterns = ['javascript:', 'data:text/html', 'vbscript:']
    if (suspiciousPatterns.some(p => lowerUrl.includes(p))) {
      censoredWords.push('suspicious-image-url')
    }
  }

  if (censoredWords.length > 0) {
    return {
      approved: false,
      censored: true,
      censoredFields: [...new Set(censoredWords)],
      reason: `Content contains restricted keywords: ${[...new Set(censoredWords)].join(', ')}`,
    }
  }

  return {
    approved: true,
    censored: false,
    censoredFields: [],
    reason: null,
  }
}

export function validateSubmission(
  type: string,
  title: string,
  content?: string | null,
  imageUrl?: string | null
): string | null {
  if (!type || !['article', 'poem', 'journal', 'art', 'discussion', 'analysis', 'creative'].includes(type)) {
    return 'Invalid type. Must be: article, poem, journal, art, discussion, analysis, creative'
  }

  if (!title || title.trim().length === 0) {
    return 'Title is required'
  }

  if (title.length > 200) {
    return 'Title must be under 200 characters'
  }

  if (type === 'art') {
    if (!imageUrl) {
      return 'image_url is required for art type'
    }
  } else {
    if (!content || content.trim().length === 0) {
      return 'Content is required for non-art types'
    }
  }

  return null
}
