// Client-side translation cache and request batching for content MT.
// Translations persist in localStorage so repeat visits render instantly;
// same-tick requests collapse into one POST /api/translate call.

const STORE_KEY = "2nothing:content-tr:v1";
const MAX_STORE_ENTRIES = 600;
const BATCH_FLUSH_MS = 60;
const BATCH_MAX = 25;
const FAILURE_COOLDOWN_MS = 10_000;

function hashText(text: string): string {
  // djb2 — stable, synchronous, good enough for cache keys (not security).
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36) + ":" + text.length;
}

type Store = Record<string, string | null>;
let store: Store | null = null;

function loadStore(): Store {
  if (store) return store;
  if (typeof window === "undefined") return {};
  try {
    store = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}") as Store;
  } catch {
    store = {};
  }
  return store;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (typeof window === "undefined") return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = loadStore();
    const keys = Object.keys(data);
    if (keys.length > MAX_STORE_ENTRIES) {
      for (const key of keys.slice(0, keys.length - MAX_STORE_ENTRIES)) delete data[key];
    }
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable — memory cache still works */
    }
  }, 800);
}

/** undefined = no cached entry; null = known-failed translation. */
export function cachedTranslation(text: string, target: string): string | null | undefined {
  if (memFailed.has(hashText(text) + target)) return null;
  const value = loadStore()[`${target}:${hashText(text)}`];
  return value === undefined ? undefined : value;
}

function remember(text: string, target: string, value: string | null) {
  if (value === null) {
    // failures live in memory only — retried next visit/session
    memFailed.add(hashText(text) + target);
    return;
  }
  loadStore()[`${target}:${hashText(text)}`] = value;
  persist();
}

const memFailed = new Set<string>();

type Waiter = { resolve: () => void };
const pendingByTarget = new Map<string, Map<string, Waiter[]>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFailureAt = 0;

function enqueue(texts: string[], target: string, waiter: () => void) {
  let group = pendingByTarget.get(target);
  if (!group) {
    group = new Map();
    pendingByTarget.set(target, group);
  }
  for (const text of texts) {
    const list = group.get(text);
    if (list) list.push({ resolve: waiter });
    else group.set(text, [{ resolve: waiter }]);
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), BATCH_FLUSH_MS);
  }
}

async function flush() {
  flushTimer = null;
  const groups = [...pendingByTarget.entries()];
  pendingByTarget.clear();
  for (const [target, group] of groups) {
    const texts = [...group.keys()];
    if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
      resolveGroup(group);
      continue;
    }
    for (let i = 0; i < texts.length; i += BATCH_MAX) {
      const chunk = texts.slice(i, i + BATCH_MAX);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk, target }),
        });
        const json = await res.json();
        const translations = json?.data?.translations;
        if (res.ok && json?.success && Array.isArray(translations)) {
          chunk.forEach((text, index) => {
            const value = typeof translations[index] === "string" ? (translations[index] as string) : null;
            remember(text, target, value);
          });
        } else {
          lastFailureAt = Date.now();
        }
      } catch {
        lastFailureAt = Date.now();
      }
    }
    resolveGroup(group);
  }
}

// Waiters just wait for the flush to finish; callers re-read the cache.
function resolveGroup(group: Map<string, Waiter[]>) {
  for (const waiters of group.values()) {
    for (const waiter of waiters) waiter.resolve();
  }
}

export function requestTranslations(
  texts: string[],
  target: string,
): Promise<void> {
  const missing = [...new Set(texts.filter((t) => t && t.trim()))].filter(
    (t) => cachedTranslation(t, target) === undefined,
  );
  if (missing.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    enqueue(missing, target, () => resolve());
  });
}

/** Forget a known failure so the next request retries the provider. */
export function clearFailedTranslation(text: string, target: string) {
  memFailed.delete(hashText(text) + target);
}
