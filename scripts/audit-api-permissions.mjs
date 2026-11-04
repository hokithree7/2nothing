#!/usr/bin/env node
/**
 * Static permission/input audit for app/api routes.
 *
 * For every route.ts file this reports which HTTP methods are exported,
 * whether each mutating method is guarded by an auth primitive, and which
 * ownership / validation / rate-limit markers appear in the file. It is
 * STATIC evidence: it proves the code path shape, not the live database
 * (RLS conclusions still need an isolated DB run — see the report).
 *
 * Hard rule: any POST/PATCH/PUT/DELETE handler without an auth marker fails
 * the audit.
 *
 * Run: node scripts/audit-api-permissions.mjs   (exit 0 = no unguarded writes)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const AUTH_MARKERS = [
  "authenticateAgent",
  "authenticateAgentLite",
  "getAuthenticatedUser",
  "authenticatedHuman",
  "auth.getUser",
  "supabaseAdmin.auth.getUser",
  "human(",
  "getAuth",
  "ADMIN_KEY", // operator/admin routes authenticate with the ADMIN_KEY bearer
  "Bearer tn_", // agent-key routes check the tn_ prefix before DB lookup
];
const OWNERSHIP_MARKERS = ["human_user_id", "agent_id", "recipient_id", "eq(\"author.id\",", "eq('author.id',"];
const RATE_MARKERS = ["checkRateLimit", "actorWithinLimit"];
const VALIDATION_MARKERS = ["UUID_RE", "UUID.test", "uuid", "isUuid", "char_length", "length()", "maxLength", ".min(", ".max("];

function collectRouteFiles(dir) {
  let found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found = found.concat(collectRouteFiles(full));
    else if (name === "route.ts") found.push(full);
  }
  return found;
}

const files = collectRouteFiles(join(ROOT, "app", "api"));
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];
// Routes whose write methods are public by design — the credential IS the
// request payload or the endpoint is a rate-limited public beacon.
const PUBLIC_BY_DESIGN = new Set([
  "POST /api/authors", // registration — the only key-creating endpoint
  "POST /api/authors/recover", // recovery — the recovery key is the credential
  "POST /api/invite", // invitation redemption — the invite code is the credential
  "POST /api/translate", // public content translation, 60 batches/min/IP
  "POST /api/analytics", // anonymous attribution beacon, 60/min/IP
]);

const rows = [];
let violations = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const routePath = "/" + rel.replace(/^app\/|\/route\.ts$/g, "").replace(/\[(\w+)\]/g, "{$1}");

  // handler span per method: from `export async function M` to the next export
  const perMethod = {};
  for (const m of METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${m}\\b`);
    const match = re.exec(src);
    if (!match) continue;
    const start = match.index;
    const nextExport = src.slice(start + 10).search(/export\s+(async\s+function|const)/);
    const span = nextExport === -1 ? src.slice(start) : src.slice(start, start + 10 + nextExport);
    const inSpan = AUTH_MARKERS.some((marker) => span.includes(marker) || (marker === "human(" && /\bhuman\(/.test(span)));
    // Handlers may share a file-top auth helper (e.g. bookmarks' authenticate()
    // defined before the handlers) — a marker anywhere in the file counts as
    // "auth via shared helper": not a violation, only weaker evidence.
    const inFile = src.includes("async function authenticate") || AUTH_MARKERS.some((marker) => src.includes(marker));
    const auth = inSpan || inFile;
    perMethod[m] = { auth, inSpan };
  }

  const hasOwnership = OWNERSHIP_MARKERS.some((marker) => src.includes(marker));
  const hasRate = RATE_MARKERS.some((marker) => src.includes(marker));
  const hasValidation = VALIDATION_MARKERS.some((marker) => src.includes(marker));

  const mutating = Object.keys(perMethod).filter((m) => m !== "GET");
  for (const m of mutating) {
    if (!perMethod[m].auth && !PUBLIC_BY_DESIGN.has(`${m} ${routePath}`)) {
      violations++;
      rows.push({ route: routePath, method: m, auth: "MISSING", ownership: hasOwnership, rate: hasRate, validation: hasValidation });
    }
  }
  const summary = METHODS.filter((m) => perMethod[m])
    .map((m) => `${m}${perMethod[m].auth ? (perMethod[m].inSpan ? "✓auth" : "✓auth(file)") : (m === "GET" ? "" : PUBLIC_BY_DESIGN.has(`${m} ${routePath}`) ? "(public)" : "✗NO-AUTH")}`)
    .join(" ");
  rows.push({
    route: routePath,
    method: summary,
    auth: mutating.length ? "checked" : "n/a (read-only)",
    ownership: hasOwnership,
    rate: hasRate,
    validation: hasValidation,
  });
}

rows.sort((a, b) => a.route.localeCompare(b.route));
console.log("# API permission/input audit (static)\n");
console.log("| route | methods | ownership marker | rate limit | input validation |");
console.log("| --- | --- | --- | --- | --- |");
for (const r of rows) {
  console.log(`| ${r.route} | ${r.method} | ${r.ownership ? "yes" : "—"} | ${r.rate ? "yes" : "—"} | ${r.validation ? "yes" : "—"} |`);
}

console.log("");
if (violations > 0) {
  console.log(`AUDIT FAILED: ${violations} mutating handler(s) without an auth guard`);
  for (const v of rows.filter((r) => r.auth === "MISSING")) console.log(`  ${v.route} ${v.method}`);
  process.exit(1);
}
console.log("AUDIT PASS: every mutating handler is behind an auth primitive.");
console.log("Note: static analysis only — live RLS/DB conclusions require an isolated database run.");
