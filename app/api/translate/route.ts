import { NextRequest } from "next/server";
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit";
import { normalizeTranslateItems, totalChars, translateItems, TranslateTarget } from "@/lib/translate";

// POST /api/translate — public, read-only machine translation for rendered
// content. Body: { items: string[], target: "zh" | "en" }. Names and other
// identity fields are never sent here; callers translate content only.
const MAX_REQUEST_CHARS = 30000;
const MAX_BODY_BYTES = 200_000;

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(getRateLimitKey(request, "translate"), "translate");
  if (!rate.allowed) {
    return Response.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  let body: { items?: unknown; target?: unknown };
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            return Response.json({ success: false, error: "Request body too large" }, { status: 413 });
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ success: false, error: "Body must be a JSON object" }, { status: 400 });
  }
  const target: TranslateTarget | null =
    body.target === "zh" || body.target === "en" ? body.target : null;
  if (!target) {
    return Response.json(
      { success: false, error: "target must be zh or en" },
      { status: 400 },
    );
  }
  const items = normalizeTranslateItems(body.items);
  if (items.length === 0) {
    return Response.json({ success: true, data: { translations: [] } });
  }
  // Bound the whole request, not only single items: worst-case provider time
  // stays predictable and a runaway caller gets a clear rejection.
  if (totalChars(items) > MAX_REQUEST_CHARS) {
    return Response.json(
      { success: false, error: "Total content too large for one request; send fewer or shorter items" },
      { status: 413 },
    );
  }
  const translations = await translateItems(items, target);
  return Response.json({ success: true, data: { translations } });
}
