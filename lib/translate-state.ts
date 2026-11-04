// Pure decision logic for the per-card translation group state.
// Extracted from useContentTranslations so it can be unit-tested without a
// renderer (see lib/translate.test.ts).

export type GroupStatus = {
  loading: boolean;
  anyFailed: boolean;
  showingTranslated: boolean;
  needFetch: boolean;
};

/**
 * @param translatable  per-field: whether machine translation applies at all
 *                      (false for empty / same-language / oversized fields)
 * @param resolved      per-field resolved value:
 *                      undefined = not fetched yet, null = failed, string = ready
 * @param showOriginal  whether the reader toggled back to the source text
 */
export function computeGroupStatus(
  translatable: boolean[],
  resolved: (string | null | undefined)[],
  showOriginal = false,
): GroupStatus {
  // Only fields that actually need translation can be "missing" — native
  // fields are undefined forever and must never keep the card in Translating….
  const anyMissing = resolved.some((v, i) => translatable[i] && v === undefined);
  const anyFailed = resolved.some((v, i) => translatable[i] && v === null);
  const hasTranslatable = translatable.some(Boolean);
  return {
    loading: hasTranslatable && anyMissing,
    anyFailed,
    showingTranslated:
      hasTranslatable &&
      !showOriginal &&
      resolved.some((v, i) => translatable[i] && typeof v === "string"),
    needFetch: hasTranslatable && anyMissing,
  };
}
