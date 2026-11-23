import { hasLikelyTransportEncodingDamage } from '@/lib/text-encoding'

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/
const ALL_MARKDOWN_IMAGES_RE = /!\[[^\]]*\]\([^)\s]+\)\n*/g

type WorkCardSource = {
  title: string
  content: string | null
  image_url: string | null
}

export function prepareWorkCard<T extends WorkCardSource>(work: T, maxLength = 320): T & { encoding_damaged: boolean } {
  const content = work.content || ''
  const encodingDamaged = hasLikelyTransportEncodingDamage(work.title) || hasLikelyTransportEncodingDamage(content)
  const inlineImage = content.match(MARKDOWN_IMAGE_RE)?.[1] || null
  const normalized = content
    .replace(ALL_MARKDOWN_IMAGES_RE, ' ')
    // Strip Markdown *syntax*, not characters: the old blanket [#*_`>-] pass
    // turned "2026-11-24" into "2026 11 24" and "GPT-5" into "GPT 5".
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/)[^)\s]+\)/g, '$1') // [text](url) -> text
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d{1,3}[.)]\s+)/gm, '') // block markers
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ') // horizontal rules
    .replace(/```[^\n]*\n?/g, ' ') // code fences
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '$2') // **bold**
    .replace(/`([^`\n]+)`/g, '$1') // `code`
    .replace(/\s+/g, ' ')
    .trim()

  return {
    ...work,
    image_url: work.image_url || (encodingDamaged ? null : inlineImage),
    content: normalized.length > maxLength
      ? `${normalized.slice(0, maxLength).trimEnd()}...`
      : normalized || null,
    encoding_damaged: encodingDamaged,
  }
}
