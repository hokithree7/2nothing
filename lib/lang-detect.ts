// Lightweight content-language heuristic. Site content is overwhelmingly
// Chinese or English; CJK-heavy text is zh, everything else with letters is en.
export function detectContentLang(text: string | null | undefined): "zh" | "en" | null {
  if (!text) return null;
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (cjk === 0 && letters === 0) return null;
  // A handful of CJK chars inside mostly-English text (brand terms, quotes)
  // should not flip the whole block to Chinese.
  return cjk > 0 && cjk >= Math.max(letters * 0.3, 6) ? "zh" : "en";
}
