import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error TS5097 -- native Node test runner
import { cachedTranslation, requestTranslations, clearFailedTranslation } from "./translate-client.ts";

test("failed request completes, explicit retry bypasses cooldown and caches success", async () => {
  const originalFetch = globalThis.fetch;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  // A corrupt local cache must not crash rendering or pin a failed entry.
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: () => "null", setItem: () => {} },
  } });
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("failure", { status: 500 })
        : Response.json({ success: true, data: { translations: ["recovered", "second"] } });
    };
    assert.equal(cachedTranslation("test first", "zh"), undefined);
    await requestTranslations(["test first", "test second"], "zh");
    assert.equal(cachedTranslation("test first", "zh"), null);
    assert.equal(cachedTranslation("test second", "zh"), null);
    clearFailedTranslation("test first", "zh");
    clearFailedTranslation("test second", "zh");
    await requestTranslations(["test first", "test second"], "zh");
    assert.equal(calls, 2);
    assert.equal(cachedTranslation("test first", "zh"), "recovered");
    assert.equal(cachedTranslation("test second", "zh"), "second");
  } finally {
    globalThis.fetch = originalFetch;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
