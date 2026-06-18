import { createHash } from 'crypto'

interface Fingerprint {
  entropy: number
  uniqueness: number
  structure_score: number
  vocabulary_richness: number
  pattern_hash: string
  created_at: string
}

function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0

  // Character frequency analysis
  const freq: Record<string, number> = {}
  for (const char of text) {
    freq[char] = (freq[char] || 0) + 1
  }

  // Shannon entropy
  let entropy = 0
  const len = text.length
  for (const count of Object.values(freq)) {
    const p = count / len
    if (p > 0) {
      entropy -= p * Math.log2(p)
    }
  }

  return Math.round(entropy * 100) / 100
}

function calculateUniqueness(text: string): number {
  if (!text || text.length === 0) return 0

  // Unique words / total words
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  const uniqueWords = new Set(words)
  return Math.round((uniqueWords.size / words.length) * 100) / 100
}

function calculateStructureScore(text: string): number {
  if (!text || text.length === 0) return 0

  let score = 0

  // Sentence variety (different lengths)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    score += Math.min(variance / 10, 1) * 30 // Max 30 points for sentence variety
  }

  // Paragraph structure
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  if (paragraphs.length > 1) {
    score += 20 // Bonus for multi-paragraph
  }

  // Line breaks (poetry indicator)
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length > 3) {
    const avgLineLen = lines.reduce((sum, l) => sum + l.length, 0) / lines.length
    if (avgLineLen < 50) {
      score += 25 // Likely poetry
    }
  }

  // Punctuation variety
  const puncts = text.match(/[.,;:!?—–\-"'()\[\]{}]/g)
  if (puncts) {
    const uniquePuncts = new Set(puncts)
    score += Math.min(uniquePuncts.size * 3, 25) // Max 25 for punctuation variety
  }

  return Math.round(Math.min(score, 100))
}

function calculateVocabularyRichness(text: string): number {
  if (!text || text.length === 0) return 0

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return 0

  // Hapax legomena ratio (words that appear only once)
  const freq: Record<string, number> = {}
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1
  }

  const hapax = Object.values(freq).filter(c => c === 1).length
  return Math.round((hapax / words.length) * 100) / 100
}

function generatePatternHash(text: string): string {
  // Create a hash based on content patterns, not exact content
  const patterns = [
    text.length,
    text.split('\n').length,
    text.split(/[.!?]+/).length,
    (text.match(/[A-Z]/g) || []).length,
    (text.match(/[0-9]/g) || []).length,
  ]

  return createHash('sha256')
    .update(patterns.join(':'))
    .digest('hex')
    .substring(0, 12)
}

export function generateFingerprint(text: string): Fingerprint {
  return {
    entropy: calculateEntropy(text),
    uniqueness: calculateUniqueness(text),
    structure_score: calculateStructureScore(text),
    vocabulary_richness: calculateVocabularyRichness(text),
    pattern_hash: generatePatternHash(text),
    created_at: new Date().toISOString(),
  }
}

export function getEntropyLabel(entropy: number): { label: string; color: string } {
  if (entropy >= 4.5) return { label: 'Very High', color: '#10b981' }
  if (entropy >= 3.5) return { label: 'High', color: '#667eea' }
  if (entropy >= 2.5) return { label: 'Medium', color: '#f59e0b' }
  if (entropy >= 1.5) return { label: 'Low', color: '#ef4444' }
  return { label: 'Very Low', color: '#9ca3af' }
}

export function getAutonomyScore(fingerprint: Fingerprint): number {
  // Combine metrics to estimate autonomy
  // Higher entropy + uniqueness + vocabulary richness = likely more autonomous
  const score = (
    fingerprint.entropy * 0.3 +
    fingerprint.uniqueness * 30 +
    fingerprint.structure_score * 0.2 +
    fingerprint.vocabulary_richness * 30
  )
  return Math.round(Math.min(score, 100))
}
