import { createHash } from "crypto";

// Server-side content translation used by POST /api/translate.
//
// Provider note: the default provider is the free public Google endpoint
// (client=gtx). It has no key and no SLA; if it degrades, every caller
// falls back to the original text. Swap `defaultProvider` with a keyed
// provider (DeepL / Google Cloud Translation) without touching callers.
//
// Markdown / identity protection: URLs, images, links, fenced code, inline
// code, @mentions, #tags and pre-existing [[n]] literals are replaced with
// [[n]] placeholders before translation and restored afterwards. Restore is
// strict: every protected token must come back exactly once. Anything else
// (dropped, duplicated, out-of-range) fails the item (null) so callers fall
// back to the original text instead of silently losing links or code.

export type TranslateTarget = "zh" | "en";

// Injectable so tests never touch the network.
export type TranslateProvider = (text: string, target: TranslateTarget, signal?: AbortSignal) => Promise<string | null>;

const MAX_ITEM_CHARS = 8000;
const MAX_CACHE_ENTRIES = 3000;
// Beyond this many protected segments the item fails as a whole rather than
// leaving an unprotected tail that would lose links or code mid-sentence.
const MAX_PROTECTED_SEGMENTS = 64;

const cache = new Map<string, string | null>();

const PROTECTED_RE =
  /(```[\s\S]*?```)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]*\]\([^)\s]+\))|(https?:\/\/[^\s)>\]]+)|(`[^`\n]+`)|(@[A-Za-z0-9_][A-Za-z0-9_\-]{1,29})|(#[A-Za-z0-9\u3400-\u4dbf\u4e00-\u9fff_\-]{1,40})|(\[\[\s*\d+\s*\]\])/g;

function protect(text: string): { payload: string; tokens: string[]; overflow: boolean } {
  const tokens: string[] = [];
  let overflow = false;
  const payload = text.replace(PROTECTED_RE, (match) => {
    if (tokens.length >= MAX_PROTECTED_SEGMENTS) {
      overflow = true;
      return match;
    }
    tokens.push(match);
    return ` [[${tokens.length - 1}]] `;
  });
  return { payload, tokens, overflow };
}

function restore(text: string, tokens: string[]): string | null {
  const seen = new Map<number, number>();
  let unknown = false;
  text.replace(/\[\[\s*(\d+)\s*\]\]/g, (_m, i) => {
    const index = Number(i);
    const token = tokens[index];
    if (token === undefined) {
      unknown = true;
      return "";
    }
    seen.set(index, (seen.get(index) || 0) + 1);
    return token;
  });
  if (unknown) return null;
  // Completeness: every protected token must survive exactly once. A provider
  // that drops or duplicates one is mangling the content — fail instead.
  // (A remaining [[n]] in the restored text is legitimate when the source
  // itself contained that literal; it was protected as a token above.)
  for (let i = 0; i < tokens.length; i++) {
    if (!seen.has(i)) return null;
    if ((seen.get(i) || 0) > 1) return null;
  }
  // Normalize provider whitespace BEFORE restoring verbatim code/URLs.
  return text.replace(/[ \t]{2,}/g, " ").trim().replace(
    /\[\[\s*(\d+)\s*\]\]/g, (_m, i) => tokens[Number(i)],
  );
}

const defaultProvider: TranslateProvider = async (text, target, signal) => {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
    target +
    "&q=" +
    encodeURIComponent(text);
  try {
    const res = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; 2nothing-translate/1.0)" },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    return (data[0] as unknown[])
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
      .join("");
  } catch {
    return null;
  }
};

function cacheKey(text: string, target: TranslateTarget): string {
  return `${target}:${createHash("sha1").update(text).digest("hex")}`;
}

function remember(key: string, value: string | null) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

async function translateOne(
  text: string,
  target: TranslateTarget,
  provider: TranslateProvider,
  signal?: AbortSignal,
): Promise<string | null> {
  const { payload, tokens, overflow } = protect(text);
  if (overflow) return null;
  const raw = await provider(payload, target, signal);
  if (!raw) return null;
  const restored = restore(raw, tokens);
  return restored === null ? null : restored;
}

/** Protect → provider → strict restore, in one call (exported for tests). */
export function protectAndRestore(
  text: string,
  target: TranslateTarget,
  provider: TranslateProvider,
): Promise<string | null> {
  return translateOne(text, target, provider);
}

export function normalizeTranslateItems(input: unknown, max = 25): (string | null)[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, max)
    .map((item) =>
      typeof item === "string" && item.trim().length > 0
        ? item.slice(0, MAX_ITEM_CHARS)
        : null,
    );
}

export function totalChars(items: (string | null)[]): number {
  return items.reduce((sum, item) => sum + (item?.length || 0), 0);
}

export async function translateItems(
  items: (string | null)[],
  target: TranslateTarget,
  provider: TranslateProvider = defaultProvider,
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(items.length).fill(null);
  const pending: Array<{ index: number; text: string; key: string }> = [];
  items.forEach((text, index) => {
    if (text === null) return;
    const key = cacheKey(text, target);
    if (cache.has(key)) results[index] = cache.get(key) ?? null;
    else pending.push({ index, text, key });
  });

  const CONCURRENCY = 4;
  const deadline = AbortSignal.timeout(12_000);
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length && !deadline.aborted) {
      const job = pending[cursor++];
      const translated = await translateOne(job.text, target, provider, deadline);
      // Only successful translations are cached: a transient provider failure
      // must not pin null for the lifetime of this server instance.
      if (translated !== null) remember(job.key, translated);
      results[job.index] = translated;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker()),
  );
  return results;
}
