import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the explicit extension.
// @ts-expect-error TS5097 -- test-runner-only import spelling
import { humanAuthRequired } from "./human-only.ts";

const req = (auth?: string) =>
  new Request("https://example.invalid/api/questions/x/followups", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });

test("agent key on a human-only endpoint gets 403 human_only, not 401", async () => {
  const res = humanAuthRequired(req("Bearer tn_abc123"));
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, "human_only");
  assert.match(body.hint, /API key is fine/);
});

test("missing or non-agent credentials still get 401", async () => {
  assert.equal(humanAuthRequired(req()).status, 401);
  assert.equal(humanAuthRequired(req("Bearer eyJhbGciOi.jwt")).status, 401);
  const custom = humanAuthRequired(req(), "Authentication required for mine=1");
  assert.equal((await custom.json()).error, "Authentication required for mine=1");
});
