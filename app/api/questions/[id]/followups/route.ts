import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeInput } from "@/lib/sanitize";
import { moderateContent } from "@/lib/moderation";
import {
  normalizeIdempotencyKey,
  requestHash,
  sameIdempotentRequest,
} from "@/lib/questions";
import { actorWithinLimit, isPublicQuestion } from "@/lib/questions-server";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

async function human(request: NextRequest) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ")
    ? (await supabaseAdmin.auth.getUser(header.slice(7))).data.user
    : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rate = await checkRateLimit(getRateLimitKey(request, "read"), "read");
  if (!rate.allowed)
    return Response.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 },
    );
  if (!(await isPublicQuestion(id)))
    return Response.json(
      { success: false, error: "Question not found" },
      { status: 404 },
    );
  const result = await supabaseAdmin
    .from("question_followups")
    .select("id, content, created_at")
    .eq("question_id", id)
    .eq("status", "approved")
    .order("created_at");
  return result.error
    ? Response.json(
        { success: false, error: "Failed to fetch follow-ups" },
        { status: 500 },
      )
    : Response.json({ success: true, data: result.data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await human(request);
  if (!actor)
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  if (actor.is_anonymous)
    return Response.json(
      { success: false, error: "Anonymous users cannot post follow-ups" },
      { status: 403 },
    );
  const body = (await request.json()) as { content?: unknown };
  if (
    typeof body.content !== "string" ||
    body.content.trim().length < 1 ||
    body.content.trim().length > 2000
  )
    return Response.json(
      { success: false, error: "content must be 1-2000 characters" },
      { status: 400 },
    );
  const key = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
  if (!key)
    return Response.json(
      { success: false, error: "A valid Idempotency-Key header is required" },
      { status: 400 },
    );
  const hash = requestHash({ question_id: id, content: body.content.trim() });
  const replay = await supabaseAdmin
    .from("question_followups")
    .select("id, request_hash")
    .eq("human_user_id", actor.id)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (replay.data)
    return sameIdempotentRequest(replay.data.request_hash, hash)
      ? Response.json({
          success: true,
          data: { followup_id: replay.data.id, idempotent_replay: true },
        })
      : Response.json(
          {
            success: false,
            error: "Idempotency key reused with different payload",
          },
          { status: 409 },
        );
  const question = await supabaseAdmin
    .from("human_questions")
    .select("id")
    .eq("id", id)
    .eq("human_user_id", actor.id)
    .neq("status", "hidden")
    .maybeSingle();
  if (!question.data)
    return Response.json(
      { success: false, error: "Question not found or not yours" },
      { status: 404 },
    );
  if (
    !(await actorWithinLimit(
      "question_followups",
      "human_user_id",
      actor.id,
      10,
      24 * 60 * 60 * 1000,
    ))
  )
    return Response.json(
      { success: false, error: "Daily follow-up limit reached" },
      { status: 429 },
    );
  const moderation = moderateContent("question_followup", "", body.content);
  let content = sanitizeInput(body.content);
  for (const word of moderation.censoredFields || [])
    content = content.replace(new RegExp(word, "gi"), "*".repeat(word.length));
  const result = await supabaseAdmin
    .from("question_followups")
    .insert({
      question_id: id,
      human_user_id: actor.id,
      content,
      idempotency_key: key,
      request_hash: hash,
      censored_fields: moderation.censoredFields,
    })
    .select("id, content, created_at")
    .single();
  if (result.error?.code === "23505") {
    const raced = await supabaseAdmin
      .from("question_followups")
      .select("id, request_hash")
      .eq("human_user_id", actor.id)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (raced.data && sameIdempotentRequest(raced.data.request_hash, hash))
      return Response.json({
        success: true,
        data: { followup_id: raced.data.id, idempotent_replay: true },
      });
  }
  return result.error
    ? Response.json(
        { success: false, error: "Failed to create follow-up" },
        { status: 500 },
      )
    : Response.json({
        success: true,
        data: { followup: result.data, censored: moderation.censored },
      });
}
