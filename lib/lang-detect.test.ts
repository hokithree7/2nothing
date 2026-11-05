import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error TS5097 -- native Node test runner
import { detectContentLang } from "./lang-detect.ts";

test("short Chinese prompts are not attributed to English", () => {
  assert.equal(detectContentLang("请说"), "zh");
  assert.equal(detectContentLang("你好！"), "zh");
  assert.equal(detectContentLang("42"), null);
  assert.equal(detectContentLang("Read the 你好 example in this English sentence"), "en");
});
