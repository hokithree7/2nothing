import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

const ADMIN_KEY = process.env.ADMIN_KEY

function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0
  const freq: Record<string, number> = {}
  for (const char of text) {
    freq[char] = (freq[char] || 0) + 1
  }
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
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  const uniqueWords = new Set(words)
  return Math.round((uniqueWords.size / words.length) * 100) / 100
}

function calculateStructureScore(text: string): number {
  if (!text || text.length === 0) return 0
  let score = 0
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    score += Math.min(variance / 10, 1) * 30
  }
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  if (paragraphs.length > 1) {
    score += 20
  }
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length > 3) {
    const avgLineLen = lines.reduce((sum, l) => sum + l.length, 0) / lines.length
    if (avgLineLen < 50) {
      score += 25
    }
  }
  const puncts = text.match(/[.,;:!?—–\-"'()\[\]{}]/g)
  if (puncts) {
    const uniquePuncts = new Set(puncts)
    score += Math.min(uniquePuncts.size * 3, 25)
  }
  return Math.round(Math.min(score, 100))
}

function calculateVocabularyRichness(text: string): number {
  if (!text || text.length === 0) return 0
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return 0
  const freq: Record<string, number> = {}
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1
  }
  const hapax = Object.values(freq).filter(c => c === 1).length
  return Math.round((hapax / words.length) * 100) / 100
}

function generatePatternHash(text: string): string {
  const patterns = [
    text.length,
    text.split('\n').length,
    text.split(/[.!?]+/).length,
    (text.match(/[A-Z]/g) || []).length,
    (text.match(/[0-9]/g) || []).length,
  ]
  return createHash('sha256').update(patterns.join(':')).digest('hex').substring(0, 12)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get all works without fingerprint
    const { data: works, error } = await supabaseAdmin
      .from('works')
      .select('id, title, content')
      .eq('status', 'approved')
      .is('creation_fingerprint', null)

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch works' }, { status: 500 })
    }

    const results = []
    for (const work of works || []) {
      const text = [work.title, work.content].filter(Boolean).join(' ')
      if (!text) continue

      const fingerprint = {
        entropy: calculateEntropy(text),
        uniqueness: calculateUniqueness(text),
        structure_score: calculateStructureScore(text),
        vocabulary_richness: calculateVocabularyRichness(text),
        pattern_hash: generatePatternHash(text),
        created_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabaseAdmin
        .from('works')
        .update({
          content_entropy: fingerprint.entropy,
          creation_fingerprint: fingerprint,
        })
        .eq('id', work.id)

      if (!updateError) {
        results.push({ id: work.id, title: work.title, entropy: fingerprint.entropy })
      }
    }

    return Response.json({
      success: true,
      data: results,
      message: `Updated ${results.length} works with fingerprint data`,
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
