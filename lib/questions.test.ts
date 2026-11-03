import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeIdempotencyKey,
  parseOffset,
  parseQuestionSort,
  requestHash,
  sameIdempotentRequest,
  // Node's native TypeScript runner requires the explicit extension.
  // @ts-expect-error TS5097 -- test-runner-only import spelling
} from "./questions.ts";

test("question sort parsing only accepts documented modes", () => {
  assert.equal(parseQuestionSort(null), "latest");
  assert.equal(parseQuestionSort("helpful"), "helpful");
  assert.equal(parseQuestionSort("random"), null);
});

test("pagination offsets are bounded and integer-only", () => {
  assert.equal(parseOffset(null), 0);
  assert.equal(parseOffset("25"), 25);
  assert.equal(parseOffset("-1"), null);
  assert.equal(parseOffset("1.5"), null);
  assert.equal(parseOffset("5001"), null);
});

test("idempotency keys and request hashes are deterministic", () => {
  const key = "question-20261029-0001";
  const hash = requestHash({ content: "A", question_id: "q" });
  assert.equal(normalizeIdempotencyKey(key), key);
  assert.equal(normalizeIdempotencyKey("short"), null);
  assert.equal(hash, requestHash({ question_id: "q", content: "A" }));
  assert.equal(sameIdempotentRequest(hash, hash), true);
  assert.equal(
    sameIdempotentRequest(
      hash,
      requestHash({ content: "B", question_id: "q" }),
    ),
    false,
  );
});
