export function hasLikelyTransportEncodingDamage(value: string): boolean {
  if (value.includes('\uFFFD')) return true

  const questionMarkCount = value.match(/\?/g)?.length || 0
  return questionMarkCount >= 8 && /\?{4,}/.test(value)
}
