// Deterministic regression tests for the translation layer (no network).
// Run: node --experimental-strip-types --test lib/translate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// The provider is injectable so these tests never touch the network.
import {
  protectAndRestore,
  translateItems,
  type TranslateProvider,
  // Node's native TypeScript runner requires the explicit extension.
  // @ts-expect-error TS5097 -- test-runner-only import spelling
} from "./translate.ts";
// @ts-expect-error TS5097 -- test-runner-only import spelling
import { computeGroupStatus } from "./translate-state.ts";
// @ts-expect-error TS5097 -- test-runner-only import spelling
import { chunkRequests } from "./translate-client.ts";

// simple deterministic mockProvider: keep placeholders, translate a marker word
const mockProvider: TranslateProvider = async (text) =>
  text.replace(/hello/g, "你好");

test("protect/restore roundtrip keeps URL, mention, tag, inline code", async () => {
  const src = "read https://example.com/a from @Palimpsest about #tag and `code here` end";
  const out = await protectAndRestore(src, "zh", mockProvider);
  assert.ok(out && out.includes("https://example.com/a"), "URL survived");
  assert.ok(out!.includes("@Palimpsest"), "mention survived");
  assert.ok(out!.includes("#tag"), "tag survived");
  assert.ok(out!.includes("`code here`"), "inline code survived");
});

test("restore fails (null) when provider drops a protected token", async () => {
  const dropping: TranslateProvider = async (text) => text.replace(/\[\[\s*\d+\s*\]\]/g, "").trim();
  const out = await protectAndRestore("visit https://example.com/a today", "zh", dropping);
  assert.equal(out, null, "dropped token must fail, not silently lose the link");
});

test("restore fails when provider duplicates a placeholder", async () => {
  const duplicating: TranslateProvider = async (text) =>
    text.replace(/\[\[\s*(\d+)\s*\]\]/g, "[[$1]] [[$1]]");
  const out = await protectAndRestore("see https://example.com/a", "zh", duplicating);
  assert.equal(out, null, "duplicated token must fail");
});

test("restore fails on out-of-range or unknown placeholders", async () => {
  const bogus: TranslateProvider = async () => "[[99]] ok";
  assert.equal(await protectAndRestore("hello https://example.com/a", "zh", bogus), null);
});

test("pre-existing [[0]] literal in source survives verbatim", async () => {
  const out = await protectAndRestore("array index [[0]] and hello", "zh", mockProvider);
  assert.ok(out && out.includes("[[0]]"), "literal kept");
});

test("more than 64 protected segments fails safely instead of leaving an unprotected tail", async () => {
  const many = Array.from({ length: 70 }, (_, i) => `@user${i}`).join(" ");
  const out = await protectAndRestore(many + " hello", "zh", mockProvider);
  assert.equal(out, null, "overflow must fail, not translate an unprotected tail");
});

test("fenced code block is protected verbatim", async () => {
  const src = "before hello\n```js\nconst url = 'https://x.com/a';\n```\nafter https://y.com/b";
  const out = await protectAndRestore(src, "zh", mockProvider);
  assert.ok(out && out.includes("const url = 'https://x.com/a';"), "fence untouched");
});

test("translateItems: partial failure returns null for failed item only", async () => {
  const provider: TranslateProvider = async (text) =>
    text.includes("BAD") ? "" : mockProvider(text, "zh"); // provider returns empty → failure
  const items = ["hello world", "BAD token", "hello again"];
  const res = await translateItems(items, "zh", provider);
  assert.equal(res[0], "你好 world");
  assert.equal(res[1], null);
  assert.equal(res[2], "你好 again");
});

test("computeGroupStatus: native fields never count as missing", () => {
  // field0 = translatable, field1 = native (same language), field2 = empty
  const st = computeGroupStatus(
    [true, false, false],
    ["你好", undefined, undefined],
  );
  assert.equal(st.loading, false, "mixed group must not stick in Translating…");
  assert.equal(st.needFetch, false);
});

test("computeGroupStatus: loading true only while translatable fields unresolved", () => {
  const st = computeGroupStatus([true, false], [undefined, undefined]);
  assert.equal(st.loading, true);
  assert.equal(st.needFetch, true);
  const failed = computeGroupStatus([true], [null]);
  assert.equal(failed.loading, false);
  assert.equal(failed.anyFailed, true);
});

test("chunkRequests splits by item count and total chars", () => {
  const items = Array.from({ length: 60 }, (_, i) => "x".repeat(100) + i);
  const chunks = chunkRequests(items, 25, 3000);
  assert.ok(chunks.length >= 3, "60 items / 25 per chunk");
  for (const c of chunks) {
    assert.ok(c.length <= 25, "item cap");
    assert.ok(c.reduce((a, t) => a + t.length, 0) <= 3000, "char cap");
  }
});
