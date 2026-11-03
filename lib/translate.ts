import { createHash } from "crypto";

// Server-side content translation used by POST /api/translate.
//
// Provider note: the default provider is the free public Google endpoint
// (client=gtx). It has no key and no SLA; if it degrades, every caller
// falls back to the original text. Swap `gtxTranslate` with a keyed
// provider (DeepL / Google Cloud Translation) without touching callers.
//
// Markdown / identity protection: URLs, images, links, code spans, @mentions
// and #tags are replaced with [[n]] placeholders before translation and
// restored afterwards. If any placeholder is lost or mangled by the provider,
// the item fails (null) instead of returning broken content.

export type TranslateTarget = "zh" | "en";

const MAX_ITEM_CHARS = 8000;
const MAX_CACHE_ENTRIES = 3000;

const cache = new Map<string, string | null>();

const PROTECTED_RE =
  /(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]*\]\([^)\s]+\))|(https?:\/\/[^\s)>\]]+)|(`[^`\n]+`)|(@[A-Za-z0-9_][A-Za-z0-9_\-]{1,29})|(#[A-Za-z0-9\u3400-\u4dbf\u4e00-\u9fff_\-]{1,40})/g;

function protect(text: string): { payload: string; tokens: string[] } {
  const tokens: string[] = [];
  const payload = text.replace(PROTECTED_RE, (match) => {
    if (tokens.length >= 64) return match; // safety: translate unprotected tail
    tokens.push(match);
    return ` [[${tokens.length - 1}]] `;
  });
  return { payload, tokens };
}

function restore(text: string, tokens: string[]): string | null {
  let missing = false;
  const restored = text.replace(/\[\[\s*(\d+)\s*\]\]/g, (_m, i) => {
    const token = tokens[Number(i)];
    if (token === undefined) {
      missing = true;
      return "";
    }
    return token;
  });
  if (missing || /\[\[\s*\d+\s*\]\]/.test(restored)) return null;
  return restored.replace(/[ \t]{2,}/g, " ").trim();
}

async function gtxTranslate(text: string, target: TranslateTarget): Promise<string | null> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
    target +
    "&q=" +
    encodeURIComponent(text);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
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
}

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

async function translateOne(text: string, target: TranslateTarget): Promise<string | null> {
  const { payload, tokens } = protect(text);
  const raw = await gtxTranslate(payload, target);
  if (!raw) return null;
  const restored = restore(raw, tokens);
  return restored === null ? null : restored;
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

export async function translateItems(
  items: (string | null)[],
  target: TranslateTarget,
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
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const job = pending[cursor++];
      const translated = await translateOne(job.text, target);
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
