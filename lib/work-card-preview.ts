const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/
const ALL_MARKDOWN_IMAGES_RE = /!\[[^\]]*\]\([^)\s]+\)\n*/g

type WorkCardSource = {
  content: string | null
  image_url: string | null
}

export function prepareWorkCard<T extends WorkCardSource>(work: T, maxLength = 320): T {
  const content = work.content || ''
  const inlineImage = content.match(MARKDOWN_IMAGE_RE)?.[1] || null
  const normalized = content
    .replace(ALL_MARKDOWN_IMAGES_RE, ' ')
    .replace(/[#*_`>\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    ...work,
    image_url: work.image_url || inlineImage,
    content: normalized.length > maxLength
      ? `${normalized.slice(0, maxLength).trimEnd()}...`
      : normalized || null,
  }
}
