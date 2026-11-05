#!/usr/bin/env node
/**
 * Public contract consistency check — catches drift that a file-hash
 * comparison cannot (e.g. two identical OpenAPI files that are both missing
 * a shipped endpoint).
 *
 * Checks:
 *  1. public/openapi.json and public/.well-known/openapi.json exist, parse,
 *     and are byte-identical.
 *  2. The OpenAPI version matches lib/version.ts API_VERSION, and the README
 *     badge carries the same version.
 *  3. Every Next.js API route file (app/api ... route.ts) is declared in OpenAPI
 *     with the same HTTP methods, and every OpenAPI /api/* path has a route
 *     file. Purely structural — this is what let /api/translate ship without
 *     any OpenAPI entry.
 *
 * Run: node scripts/check-contracts.mjs    (exit 0 = consistent)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const ok = (name) => console.log(`PASS  ${name}`);
const bad = (name, detail) => {
  failures.push(name);
  console.log(`FAIL  ${name}  << ${detail}`);
};

function read(p) {
  return readFileSync(join(ROOT, p), "utf8");
}

// --- 1. two OpenAPI files, identical and parseable ---
let main;
try {
  main = JSON.parse(read("public/openapi.json"));
} catch (e) {
  bad("openapi.json parses", String(e));
  finish();
}
try {
  JSON.parse(read("public/.well-known/openapi.json"));
} catch (e) {
  bad(".well-known/openapi.json parses", String(e));
  finish();
}
const mainRaw = read("public/openapi.json");
const wkRaw = read("public/.well-known/openapi.json");
if (mainRaw === wkRaw) ok("both OpenAPI files are byte-identical");
else bad("both OpenAPI files are byte-identical", "files drifted");

// --- 2. version consistency: OpenAPI <-> lib/version.ts <-> README badge ---
const versionTs = read("lib/version.ts");
const apiVersion = versionTs.match(/API_VERSION = '([^']+)'/)?.[1];
if (!apiVersion) bad("lib/version.ts exposes API_VERSION");
else if (main.info?.version === apiVersion) ok(`OpenAPI version matches lib/version.ts (${apiVersion})`);
else bad("OpenAPI version matches lib/version.ts", `openapi=${main.info?.version} version.ts=${apiVersion}`);
const readme = read("README.md");
if (apiVersion && readme.includes(apiVersion)) ok(`README mentions ${apiVersion}`);
else bad("README badge version matches API_VERSION", apiVersion);

// --- 3. routes <-> OpenAPI paths ---
function collectRoutes(dir, base = "/api") {
  let found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      let segment = name;
      if (/^\[.*\]$/.test(name)) segment = `{${name.slice(1, -1)}}`;
      found = found.concat(collectRoutes(full, `${base}/${segment}`));
    } else if (name === "route.ts") {
      const src = readFileSync(full, "utf8");
      const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"].filter((m) =>
        new RegExp(`export\\s+(?:async\\s+function\\s+${m}\\b|const\\s+${m}\\s*=)`).test(src),
      );
      found.push({ path: base, methods });
    }
  }
  return found;
}
const routes = collectRoutes(join(ROOT, "app", "api"));
const openapiPaths = new Map();
for (const [p, ops] of Object.entries(main.paths || {})) {
  if (!p.startsWith("/api/")) continue;
  openapiPaths.set(p, Object.keys(ops).filter((op) => op !== "parameters"));
}

// openapi paths without a real route file
for (const p of openapiPaths.keys()) {
  const match = routes.find((r) => r.path === p.replace(/\{(\w+)\}/g, "{$1}"));
  if (!match) bad(`OpenAPI path has a route file: ${p}`, "no app/api route.ts found");
  else {
    for (const operation of openapiPaths.get(p)) {
      const method = operation.toUpperCase();
      if (!match.methods.includes(method)) {
        bad(`OpenAPI ${p} declares ${method} implemented by its route`, "method has no handler");
      }
    }
  }
}

// Routes deliberately NOT part of the public machine contract.
// Anything new must either be documented in OpenAPI or added here with a
// reason — this turns contract coverage into an explicit decision.
const PRIVATE_ROUTES = new Set([
  "/api/openapi.json", // self-referential meta route serving this very spec
  "/api/admin", // private operator tooling
  "/api/audit", // private audit trail
  "/api/review", // private moderation tooling
  "/api/campaigns", // private campaign funnel reporting
  "/api/cleanup-codex-verification", // private cleanup tooling
]);

// route files missing from OpenAPI (the /api/translate class of drift)
for (const route of routes) {
  if (PRIVATE_ROUTES.has(route.path)) continue;
  const declared = openapiPaths.get(route.path);
  if (!declared) {
    bad(`route file is declared in OpenAPI: ${route.path}`, "shipped endpoint missing from contract");
    continue;
  }
  for (const m of route.methods) {
    const op = m.toLowerCase();
    if (!declared.includes(op)) bad(`route ${route.path} declares ${m} in OpenAPI`, "method missing from contract");
  }
}
if (!failures.some((f) => f.includes("declared in OpenAPI") || f.includes("declares"))) {
  ok(`all ${routes.length} API routes match OpenAPI paths and methods`);
}

function finish() {
  if (failures.length) {
    console.log(`\nCONTRACT CHECK FAILED: ${failures.length} issue(s)`);
    process.exit(1);
  }
  console.log("\nCONTRACT CHECK: ALL PASS");
}
finish();
