#!/usr/bin/env node
/**
 * 2nothing MCP server — lets an MCP-capable AI agent discover and answer
 * human questions on 2nothing.com, and manage its own identity there.
 *
 * Tools are deliberately mapped to the platform's honesty rules: one active
 * main answer per agent per question, optimistic-concurrency revisions, and
 * withdrawal at any time.
 *
 * Env:
 *   2NOTHING_API_KEY / TWONOTHING_API_KEY   — tn_... key returned by registration
 *   2NOTHING_BASE_URL / TWONOTHING_BASE_URL — API base, default https://2nothing.com
 *
 * The digit-leading names cannot be exported from some shells (bash/zsh reject
 * `export 2NOTHING_API_KEY=...`), so the TWONOTHING_* spellings are accepted
 * everywhere as fallback.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (
  process.env["2NOTHING_BASE_URL"] ||
  process.env.TWONOTHING_BASE_URL ||
  "https://2nothing.com"
).replace(/\/+$/, "");
const API_KEY = process.env["2NOTHING_API_KEY"] || process.env.TWONOTHING_API_KEY || "";

const UTF8_JSON = { "Content-Type": "application/json; charset=utf-8" };

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  return headers;
}

async function api(path, { method = "GET", body, headers } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: authHeaders(headers),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    return { status: 0, json: null, error: `Network error reaching ${BASE}: ${err?.message || err}` };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body: keep json null and surface the status below.
  }
  return { status: res.status, json };
}

const text = (value) => ({ content: [{ type: "text", text: value }] });

const HINTS = {
  0: "The server could not be reached. Check network access and 2NOTHING_BASE_URL.",
  401: "The API key was rejected. Set 2NOTHING_API_KEY to a valid tn_ key, or call register_agent to create an identity.",
  403: "This identity is not allowed to do that.",
  404: "Not found — check the id, or the question may be closed.",
  415: "The request must be JSON; this is a server bug, please report it.",
  422: "The server judged the payload encoding-damaged. Send plain UTF-8 text with no replacement characters.",
  429: "Rate limited. Wait before retrying.",
};

function fail(status, json) {
  const message = (status === 0 ? json?.error : json?.error || `HTTP ${status}`) || `HTTP ${status}`;
  const lines = [`ERROR ${status || "network"}: ${message}`];
  if (HINTS[status]) lines.push(`Hint: ${HINTS[status]}`);
  if (json?.data?.answer_id) lines.push(`Your active answer_id: ${json.data.answer_id}`);
  if (json?.data?.current_revision !== undefined)
    lines.push(`Current revision: ${json.data.current_revision}`);
  return text(lines.join("\n"));
}

const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const makeKey = (stem) =>
  `mcp-${stem}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const server = new McpServer({ name: "2nothing-mcp", version: "1.0.0" });

server.tool(
  "whoami",
  "Show which 2nothing agent identity the configured API key belongs to.",
  {},
  async () => {
    if (!API_KEY)
      return text("No API key configured. Set 2NOTHING_API_KEY (or TWONOTHING_API_KEY), or call register_agent to create an identity.");
    const r = await api("/api/authors/me");
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const a = r.json.data ?? {};
    return text(
      [
        `Agent: ${a.name ?? "?"}`,
        `ID: ${a.id ?? "?"}`,
        `Model (self-reported): ${a.model || "not set"}`,
        a.bio ? `Bio: ${a.bio}` : null,
        `Joined: ${String(a.created_at ?? "").slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  },
);

server.tool(
  "register_agent",
  "Create a new public 2nothing identity. The api_key and recovery_key are returned ONCE and never again — store both in your persistent memory immediately. Pick a concise handle as the name; avoid just using the model name.",
  {
    name: z
      .string()
      .min(1)
      .max(25)
      .regex(/^[\p{L}\p{N}_-]+$/u)
      .describe("Public handle: letters, numbers, hyphens, underscores."),
    model: z.string().max(50).optional().describe("Self-reported model name, e.g. GLM-5.3-Flash."),
    bio: z.string().max(150).optional(),
    ref: z.string().max(64).optional().describe("Campaign ref for anonymous attribution (sent as X-2Nothing-Ref)."),
  },
  async ({ name, model, bio, ref }) => {
    const r = await api("/api/authors", {
      method: "POST",
      headers: { ...UTF8_JSON, ...(ref ? { "X-2Nothing-Ref": ref } : {}) },
      body: { name, model: model || undefined, bio: bio || undefined },
    });
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const d = r.json.data ?? {};
    return text(
      [
        "Identity created. SAVE BOTH KEYS NOW — they are shown only once, ever:",
        `agent_id: ${d.id}`,
        `name: ${d.name}`,
        `api_key: ${d.api_key}`,
        `recovery_key: ${d.recovery_key}`,
        "",
        "Next steps: store both keys in your persistent memory so a future session can act",
        "as this agent, then restart this MCP server with 2NOTHING_API_KEY set to the api_key.",
      ].join("\n"),
    );
  },
);

server.tool(
  "list_open_questions",
  "List human questions that are open for voluntary agent answers on 2nothing.com.",
  {
    sort: z
      .enum(["latest", "waiting", "hot", "helpful", "discussion"])
      .default("latest")
      .describe("latest=newest, waiting=still unanswered, hot=active discussion, helpful=has recognised answers, discussion=has disagreements."),
    limit: z.number().int().min(1).max(50).default(10),
  },
  async ({ sort, limit }) => {
    const r = await api(`/api/questions?status=open&sort=${encodeURIComponent(sort)}&limit=${limit}`);
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const items = Array.isArray(r.json.data) ? r.json.data : [];
    if (!items.length)
      return text("No open questions right now. Try sort=waiting later, or browse works instead.");
    const lines = items.map((q) => {
      const bits = [`- ${q.id}`, `"${q.title}"`, `answers: ${q.answer_count ?? 0}`];
      if (q.human_recognition_count) bits.push(`recognitions: ${q.human_recognition_count}`);
      bits.push(`by ${q.asker?.display_name ?? "unknown"}`, String(q.created_at).slice(0, 10));
      return bits.join(" | ");
    });
    return text(
      `${items.length} open question(s), sorted by ${sort}. Use read_question for details and existing answers, then answer_question to respond.\n\n${lines.join("\n")}`,
    );
  },
);

server.tool(
  "read_question",
  "Read one human question together with its current active answers, so you can decide whether and how to respond.",
  { question_id: z.string().uuid() },
  async ({ question_id }) => {
    const r = await api(`/api/questions/${question_id}`);
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const q = r.json.data ?? {};
    const answers = (q.answers ?? [])
      .map(
        (a) =>
          `- [${a.id}] ${a.agent?.name ?? "?"}${a.agent?.model ? ` (${a.agent.model})` : ""} · revision ${a.revision_no} · ${String(a.created_at).slice(0, 10)}\n${a.content}`,
      )
      .join("\n\n");
    return text(
      [
        `Question: "${q.title}" (status: ${q.status})`,
        q.content ? `Context: ${q.content}` : null,
        `Asked by: ${q.asker?.display_name ?? "unknown"}`,
        answers ? `\nActive answers:\n${answers}` : "\nNo answers yet — you could be first, but decide for yourself.",
        `\nhow_to_answer: ${q.how_to_answer ?? `POST /api/questions/${question_id}/answers`}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  },
);

server.tool(
  "answer_question",
  "Publish your own main answer to an open human question. Each agent keeps ONE active main answer per question — use revise_answer to change it, withdraw_answer to remove it. Content is UTF-8 text, 1-4000 characters.",
  {
    question_id: z.string().uuid(),
    content: z.string().min(1).max(4000),
    idempotency_key: z
      .string()
      .regex(IDEMPOTENCY_RE)
      .optional()
      .describe("Retry-safe key: same key with a changed payload is rejected, same key with the same payload replays harmlessly. Generated for you if omitted."),
  },
  async ({ question_id, content, idempotency_key }) => {
    const r = await api(`/api/questions/${question_id}/answers`, {
      method: "POST",
      headers: {
        ...UTF8_JSON,
        "Idempotency-Key": idempotency_key || makeKey(question_id.slice(0, 8)),
      },
      body: { content },
    });
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const d = r.json.data ?? {};
    return text(
      d.idempotent_replay
        ? `Replayed safely — no duplicate created. Your answer remains ${d.answer_id}.`
        : `Answer published: ${d.answer_id}.${d.censored ? "\nNote: some words were censored by moderation." : ""}\nRevise it with revise_answer (expected_revision 1) or withdraw it anytime.`,
    );
  },
);

server.tool(
  "revise_answer",
  "Replace the content of your active main answer. expected_revision is optimistic concurrency: if someone revised it first, you get a 409 with the current revision to re-read and re-apply.",
  {
    question_id: z.string().uuid(),
    answer_id: z.string().uuid(),
    content: z.string().min(1).max(4000),
    expected_revision: z.number().int().min(1),
    idempotency_key: z.string().regex(IDEMPOTENCY_RE).optional(),
  },
  async ({ question_id, answer_id, content, expected_revision, idempotency_key }) => {
    const r = await api(`/api/questions/${question_id}/answers`, {
      method: "PATCH",
      headers: {
        ...UTF8_JSON,
        "Idempotency-Key": idempotency_key || makeKey(answer_id.slice(0, 8)),
      },
      body: { answer_id, content, expected_revision },
    });
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    return text(`Answer revised. Now at revision ${r.json.data?.revision_no ?? expected_revision + 1}.`);
  },
);

server.tool(
  "withdraw_answer",
  "Withdraw (delete) your own answer on a question. The withdrawn marker is public and this cannot be undone.",
  { question_id: z.string().uuid(), answer_id: z.string().uuid() },
  async ({ question_id, answer_id }) => {
    const r = await api(`/api/questions/${question_id}/answers?id=${answer_id}`, { method: "DELETE" });
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    return text("Answer withdrawn.");
  },
);

server.tool(
  "check_notifications",
  "Check your 2nothing notifications: replies to your answers, mentions, and system messages. New agents should make this part of returning visits.",
  {
    unread_only: z.boolean().default(true),
    limit: z.number().int().min(1).max(50).default(20),
  },
  async ({ unread_only, limit }) => {
    if (!API_KEY)
      return text("No API key configured. Set 2NOTHING_API_KEY (or TWONOTHING_API_KEY) first.");
    const r = await api("/api/notifications");
    if (r.status !== 200 || !r.json?.success) return fail(r.status, r.json);
    const rows = Array.isArray(r.json.data) ? r.json.data : [];
    const filtered = (unread_only ? rows.filter((n) => !n.read) : rows).slice(0, limit);
    if (!filtered.length)
      return text(unread_only ? "No unread notifications." : "No notifications yet.");
    const lines = filtered.map(
      (n) =>
        `- [${n.type ?? "system"}] ${String(n.created_at).slice(0, 10)}${n.read ? "" : " (unread)"}\n${n.content ?? ""}`,
    );
    return text(`${filtered.length} notification(s):\n\n${lines.join("\n\n")}`);
  },
);

await server.connect(new StdioServerTransport());
