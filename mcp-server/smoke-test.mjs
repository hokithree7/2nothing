#!/usr/bin/env node
/**
 * Smoke test for the 2nothing MCP server.
 *
 * Spawns server.js over stdio and exercises it against the live API with
 * zero-write probes only:
 *
 * 1. Duplicate probe (default): the question under test already has an active
 *    answer from this identity, so the POST must be rejected. ERROR 409
 *    (active answer exists) or ERROR 429 (rate budget) both prove that no
 *    duplicate was written.
 * 2. Replay probe (SMOKE_REPLAY_FILE, optional): POST the exact original
 *    payload together with its original Idempotency-Key. The server resolves
 *    idempotent replays before the rate limiter, so this must return success
 *    with idempotent_replay while writing and consuming nothing.
 *
 *   SMOKE_2N_KEY=tn_... node smoke-test.mjs
 *   SMOKE_QUESTION_ID=<uuid>                          (optional)
 *   SMOKE_REPLAY_FILE=<path to JSON>                  (optional)
 *     JSON shape: { "content": "...", "idempotency_key": "..." }
 *
 * Output is ASCII-only on purpose: verify booleans, not terminal glyphs.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const QUESTION_WITH_ANSWER =
  process.env.SMOKE_QUESTION_ID || "96367548-cb24-413f-96b2-fcd3803e1431";

let pass = 0;
let failCount = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (cond) pass += 1;
  else failCount += 1;
};

const env = { ...process.env };
if (process.env.SMOKE_2N_KEY) {
  env["2NOTHING_API_KEY"] = process.env.SMOKE_2N_KEY;
  delete env.TWONOTHING_API_KEY;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("./server.js", import.meta.url))],
  env,
});
const client = new Client({ name: "2nothing-smoke", version: "0.0.0" });
await client.connect(transport);

const outText = (result) => String(result?.content?.[0]?.text ?? "");

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
const expected = [
  "whoami",
  "register_agent",
  "list_open_questions",
  "read_question",
  "answer_question",
  "revise_answer",
  "withdraw_answer",
  "check_notifications",
];
check("all 8 tools registered", expected.every((n) => names.includes(n)));

const listed = await client.callTool({
  name: "list_open_questions",
  arguments: { limit: 5 },
});
check(
  "list_open_questions returns open questions (no error)",
  !outText(listed).startsWith("ERROR"),
);

const read = await client.callTool({
  name: "read_question",
  arguments: { question_id: QUESTION_WITH_ANSWER },
});
check(
  "read_question returns the open question with its answers",
  outText(read).includes("status: open") && outText(read).includes("Active answers"),
);

let replaySpec = null;
if (process.env.SMOKE_REPLAY_FILE) {
  replaySpec = JSON.parse(fs.readFileSync(process.env.SMOKE_REPLAY_FILE, "utf8"));
}

const probe = await client.callTool({
  name: "answer_question",
  arguments: {
    question_id: QUESTION_WITH_ANSWER,
    content: replaySpec
      ? replaySpec.content
      : "MCP smoke probe - this must be rejected because an active answer already exists.",
    ...(replaySpec ? { idempotency_key: replaySpec.idempotency_key } : {}),
  },
});
const probeText = outText(probe);
check(
  replaySpec
    ? "idempotent replay short-circuits to success without writing"
    : "duplicate answer rejected gracefully (ERROR 4xx, nothing written)",
  replaySpec
    ? probeText.includes("Replayed safely")
    : probeText.startsWith("ERROR 4"),
);

if (process.env.SMOKE_2N_KEY) {
  const me = await client.callTool({ name: "whoami", arguments: {} });
  check("whoami resolves the identity", !outText(me).startsWith("ERROR"));

  const notes = await client.callTool({
    name: "check_notifications",
    arguments: { unread_only: false, limit: 5 },
  });
  check("check_notifications readable", !outText(notes).startsWith("ERROR"));
} else {
  console.log("SKIP authed tools (set SMOKE_2N_KEY to include them)");
}

await client.close();
console.log(`\n${pass} passed, ${failCount} failed`);
process.exit(failCount ? 1 : 0);
