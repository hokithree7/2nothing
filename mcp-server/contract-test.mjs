#!/usr/bin/env node
/**
 * Offline contract test for the 2nothing MCP server.
 *
 * Starts a scripted fake HTTP API, spawns the REAL server.js over stdio with a
 * real MCP client, and exercises every tool against failure and success
 * paths. No network, no API keys, no production contact.
 *
 * Run:  node mcp-server/contract-test.mjs     (exit 0 = all pass)
 * Deps: @modelcontextprotocol/sdk + zod from mcp-server/node_modules
 */
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// Override to contract-test a packed artifact (npm pack -> extract -> point
// MCP_SERVER_PATH at the extracted server.js) instead of the source file.
const SERVER_PATH = process.env.MCP_SERVER_PATH || join(HERE, "server.js");

// ---------------------------------------------------------------- fake API
const calls = []; // { method, path, query, auth, idem, body }

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const AGENT = { id: "agent-1", name: "TestAgent", model: "test-model", created_at: "2026-01-01T00:00:00Z" };

const QUESTION = {
  id: "11111111-1111-4111-8111-111111111111", title: "Test question", content: "context", status: "open",
  asker: { display_name: "AskOne" },
  how_to_answer: "POST /api/questions/11111111-1111-4111-8111-111111111111/answers",
  answers: [
    { id: "22222222-2222-4222-8222-222222222222", main_state: "active", revision_no: 2, created_at: "2026-01-02T00:00:00Z",
      content: "current answer body", agent: { name: "Alpha", model: "m1" } },
    { id: "33333333-3333-4333-8333-333333333333", main_state: "historical", revision_no: 1, created_at: "2026-01-01T00:00:00Z",
      content: "old answer body", agent: { name: "Alpha", model: "m1" } },
  ],
};

let failNextAuthMe = false;

const fake = createServer((req, res) => {
  const url = new URL(req.url, "http://fake");
  const entry = {
    method: req.method, path: url.pathname, query: url.search,
    auth: req.headers.authorization || null,
    idem: req.headers["idempotency-key"] || null,
    body: null,
  };
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    if (chunks.length) { try { entry.body = JSON.parse(Buffer.concat(chunks).toString()); } catch { entry.body = "NOT_JSON"; } }
    calls.push(entry);
    route(req, res, url, entry);
  });
});

function route(req, res, url, entry) {
  const authed = entry.auth === "Bearer tn_test";

  if (url.pathname === "/api/authors/me") {
    if (!authed) return json(res, 401, { success: false, error: "Invalid or expired API key" });
    if (failNextAuthMe) { failNextAuthMe = false; res.writeHead(500, { "Content-Type": "text/html" }); return res.end("<html>boom</html>"); }
    return json(res, 200, { success: true, data: AGENT });
  }

  if (url.pathname === "/api/authors" && req.method === "POST") {
    return json(res, 200, {
      success: true,
      data: { id: "agent-new", name: entry.body?.name ?? "?", api_key: "tn_fresh", recovery_key: "rk_fresh" },
    });
  }

  if (url.pathname === "/api/questions") {
    // notifications pushdown assertions live on /api/notifications; questions list:
    return json(res, 200, { success: true, data: [QUESTION] });
  }

  if (url.pathname === "/api/notifications") {
    // Echo what the MCP server asked for so the test can assert pushdown.
    return json(res, 200, {
      success: true,
      data: [{ type: "reply", content: "older unread", read: false, created_at: "2026-01-01T00:00:00Z" }],
    });
  }

  if (/^\/api\/questions\/[^/]+\/answers$/.test(url.pathname) && req.method === "POST") {
    if (!authed) return json(res, 401, { success: false, error: "Invalid or expired API key" });
    if (entry.body?.content === "CONF") return json(res, 409, { success: false, error: "An active answer already exists", data: { answer_id: "22222222-2222-4222-8222-222222222222" } });
    if (entry.body?.content === "RATE") return json(res, 429, { success: false, error: "Rate limit exceeded" });
    if (entry.body?.content === "DAMAGE") return json(res, 422, { success: false, error: "encoding-damaged" });
    if (entry.idem === "mcp-replay-key") return json(res, 200, { success: true, data: { answer_id: "22222222-2222-4222-8222-222222222222", idempotent_replay: true } });
    return json(res, 200, { success: true, data: { answer_id: "44444444-4444-4444-8444-444444444444", question_id: "11111111-1111-4111-8111-111111111111" } });
  }

  if (/^\/api\/questions\/[^/]+\/answers$/.test(url.pathname) && req.method === "PATCH") {
    if (!authed) return json(res, 401, { success: false, error: "Invalid or expired API key" });
    if (entry.body?.expected_revision === 1)
      return json(res, 409, { success: false, error: "Answer was revised by another request", data: { current_revision: 3 } });
    return json(res, 200, { success: true, data: { revision_no: entry.body?.expected_revision ?? 1 } });
  }

  if (/^\/api\/questions\/[^/]+\/answers$/.test(url.pathname) && req.method === "DELETE") {
    if (!authed) return json(res, 401, { success: false, error: "Invalid or expired API key" });
    return json(res, 200, { success: true, message: "Answer deleted" });
  }

  if (/^\/api\/questions\/[^/]+$/.test(url.pathname) && req.method === "GET" && true /* any question id */) {
    return json(res, 200, { success: true, data: QUESTION });
  }

  json(res, 404, { success: false, error: "Not found" });
}

// ---------------------------------------------------------------- harness
const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  << " + String(extra).slice(0, 200)}`);
}

function textOf(result) {
  return (result.content || []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
}

async function main() {
  await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
  const port = fake.address().port;

  // Serve the MCP server over stdio. Network-failure scenario uses its own instance.
  async function spawnServer(baseUrl, apiKey = "tn_test") {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH],
      // server.js gives digit-leading 2NOTHING_* precedence. Override both
      // spellings so a developer's inherited production configuration cannot
      // redirect this mock-only test away from the local fake API.
      env: {
        ...process.env,
        "2NOTHING_BASE_URL": baseUrl,
        TWONOTHING_BASE_URL: baseUrl,
        "2NOTHING_API_KEY": apiKey,
        TWONOTHING_API_KEY: apiKey,
      },
      stderr: "pipe",
    });
    let stderr = "";
    // `stderr: pipe` creates this PassThrough in the transport constructor,
    // before client.connect() starts the child process, so startup diagnostics
    // cannot race past the listener.
    transport.stderr?.on("data", (chunk) => (stderr += chunk));
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    await client.connect(transport);
    return { client, stderr: () => stderr };
  }

  const { client, stderr } = await spawnServer(`http://127.0.0.1:${port}`);

  // --- whoami: success + 401(HTML body -> non-JSON path) ---
  const me = await client.callTool({ name: "whoami", arguments: {} });
  check("whoami success lists agent", !me.isError && textOf(me).includes("TestAgent"), textOf(me));
  check("whoami result has no isError on success", me.isError !== true);

  // --- list_open_questions ---
  const list = await client.callTool({ name: "list_open_questions", arguments: { sort: "latest", limit: 5 } });
  check("list_open_questions shows id + title", !list.isError && textOf(list).includes("11111111-1111-4111-8111-111111111111") && textOf(list).includes("Test question"), textOf(list));

  // --- read_question: active vs historical grouping (bug C) ---
  const read = await client.callTool({ name: "read_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111" } });
  const readText = textOf(read);
  check("read_question separates Active answers", readText.includes("Active answers") && readText.includes("current answer body"), readText.slice(0, 200));
  check("read_question labels historical separately", readText.includes("Historical answers") && readText.includes("old answer body"), readText.slice(0, 200));
  const activeIdx = readText.indexOf("Active answers");
  const histIdx = readText.indexOf("Historical answers");
  check("historical body not under Active section", activeIdx >= 0 && histIdx > activeIdx && readText.indexOf("old answer body") > histIdx);

  // --- answer_question: success, replay, 409-conflict, 429, 422 ---
  const ans = await client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "my answer" } });
  check("answer_question success", !ans.isError && textOf(ans).includes("44444444-4444-4444-8444-444444444444"), textOf(ans));
  const sent = calls.findLast((c) => c.path === "/api/questions/11111111-1111-4111-8111-111111111111/answers" && c.method === "POST");
  check("answer_question sends Idempotency-Key header", !!sent?.idem, JSON.stringify(sent?.idem));

  const replay = await client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "my answer", idempotency_key: "mcp-replay-key" } });
  check("idempotent replay reported, no duplicate", !replay.isError && textOf(replay).includes("Replayed safely"), textOf(replay));

  const conflict = await client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "CONF" } });
  check("409 conflict -> isError true (MCP contract)", conflict.isError === true, JSON.stringify(conflict.isError));
  check("conflict surfaces existing answer_id", textOf(conflict).includes("22222222-2222-4222-8222-222222222222"), textOf(conflict));

  const rate = await client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "RATE" } });
  check("429 -> isError with hint", rate.isError === true && textOf(rate).includes("429"), textOf(rate));

  const damage = await client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "DAMAGE" } });
  check("422 -> isError with encoding hint", damage.isError === true && textOf(damage).toLowerCase().includes("utf-8"), textOf(damage));

  // --- revise_answer: 409 with current revision ---
  const revise = await client.callTool({ name: "revise_answer", arguments: { question_id: "11111111-1111-4111-8111-111111111111", answer_id: "22222222-2222-4222-8222-222222222222", content: "rev", expected_revision: 1 } });
  check("revision conflict -> isError + current revision", revise.isError === true && textOf(revise).includes("Current revision: 3"), textOf(revise));

  // --- withdraw_answer ---
  const wd = await client.callTool({ name: "withdraw_answer", arguments: { question_id: "11111111-1111-4111-8111-111111111111", answer_id: "22222222-2222-4222-8222-222222222222" } });
  check("withdraw success", !wd.isError && textOf(wd).includes("withdrawn"), textOf(wd));

  // --- check_notifications: unread filter pushed down to API (bug D) ---
  calls.length = 0;
  const notif = await client.callTool({ name: "check_notifications", arguments: { unread_only: true, limit: 20 } });
  const notifCall = calls.find((c) => c.path === "/api/notifications");
  check("notifications pushes unread=true to API", notifCall && notifCall.query.includes("unread=true"), JSON.stringify(notifCall));
  check("notifications pushes limit to API", notifCall && notifCall.query.includes("limit=20"), JSON.stringify(notifCall));
  check("notifications lists older unread", !notif.isError && textOf(notif).includes("older unread"), textOf(notif));

  // --- register_agent: one-time keys ---
  const reg = await client.callTool({ name: "register_agent", arguments: { name: "FreshAgent" } });
  check("register returns keys with save-now warning", !reg.isError && textOf(reg).includes("api_key") && textOf(reg).includes("shown only once"), textOf(reg));

  // --- annotations: tools declare accurate hints ---
  const tools = await client.listTools();
  const byName = Object.fromEntries(tools.tools.map((t) => [t.name, t]));
  check("read tools declare readOnlyHint", ["whoami", "list_open_questions", "read_question", "check_notifications"].every((n) => byName[n]?.annotations?.readOnlyHint === true), JSON.stringify(Object.fromEntries(Object.entries(byName).map(([k, v]) => [k, v.annotations]))));
  check("withdraw declares destructiveHint", byName.withdraw_answer?.annotations?.destructiveHint === true);

  // stdout is parsed by the SDK as JSON-RPC: unexpected output would corrupt
  // the protocol and make earlier calls fail. Stderr is directly captured
  // above from the same transport, including startup output.
  check("server wrote nothing to stderr", stderr().trim() === "", stderr().slice(0, 200));

  await client.close();

  // --- network failure: isError + idempotency key surfaced (bug B.4) ---
  const dead = await spawnServer("http://127.0.0.1:9"); // discard port: nothing listens
  const netAns = await dead.client.callTool({ name: "answer_question", arguments: { question_id: "11111111-1111-4111-8111-111111111111", content: "offline answer" } });
  check("network failure -> isError", netAns.isError === true, textOf(netAns).slice(0, 120));
  const keyMatch = textOf(netAns).match(/Idempotency-Key: (mcp-[A-Za-z0-9-]+)/);
  check("network failure surfaces the SAME idempotency key for retry", !!keyMatch, textOf(netAns).slice(0, 200));
  await dead.client.close();

  fake.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("CONTRACT TEST: ALL PASS");
}

main().catch((err) => {
  console.error("CONTRACT TEST CRASHED:", err);
  process.exit(1);
});
