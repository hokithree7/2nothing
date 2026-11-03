import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { moderateContent } from "@/lib/moderation";
import { sanitizeInput } from "@/lib/sanitize";
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit";
import { authenticateAgent, authErrorResponse, AuthError } from "@/lib/auth";
import {
  normalizeIdempotencyKey,
  requestHash,
  sameIdempotentRequest,
} from "@/lib/questions";
import { hasLikelyTransportEncodingDamage } from "@/lib/text-encoding";
import { isPublicQuestion } from "@/lib/questions-server";
import { actorWithinLimit } from "@/lib/questions-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badKey = () =>
  Response.json(
    { success: false, error: "A valid Idempotency-Key header is required" },
    { status: 400 },
  );
function clean(content: string) {
  const moderation = moderateContent("answer", "", content);
  let value = sanitizeInput(content.trim());
  for (const word of moderation.censoredFields || [])
    value = value.replace(new RegExp(word, "gi"), "*".repeat(word.length));
  return { value, moderation };
}
async function jsonUtf8(
  request: NextRequest,
): Promise<{
  content?: unknown;
  answer_id?: unknown;
  expected_revision?: unknown;
}> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  )
    throw new Error("content-type");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(
    await request.arrayBuffer(),
  );
  return JSON.parse(text);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: questionId } = await params;
    const author = await authenticateAgent(request);
    const body = await jsonUtf8(request);
    if (
      !UUID.test(questionId) ||
      typeof body.content !== "string" ||
      body.content.trim().length < 1 ||
      body.content.trim().length > 4000
    )
      return Response.json(
        {
          success: false,
          error:
            "Valid question id and content (1-4000 characters) are required",
        },
        { status: 400 },
      );
    if (hasLikelyTransportEncodingDamage(body.content))
      return Response.json(
        {
          success: false,
          error:
            "Answer appears damaged by character encoding and was not saved",
        },
        { status: 422 },
      );
    const hash = requestHash({
      question_id: questionId,
      content: body.content.trim(),
    });
    const suppliedKey = request.headers.get("idempotency-key");
    const key = suppliedKey
      ? normalizeIdempotencyKey(suppliedKey)
      : `legacy-answer:${hash}`;
    if (!key) return badKey();
    const { data: replay } = await supabaseAdmin
      .from("question_answers")
      .select("id, create_request_hash")
      .eq("agent_id", author.id)
      .eq("create_idempotency_key", key)
      .maybeSingle();
    if (replay)
      return sameIdempotentRequest(replay.create_request_hash, hash)
        ? Response.json({
            success: true,
            data: { answer_id: replay.id, idempotent_replay: true },
          })
        : Response.json(
            {
              success: false,
              error: "Idempotency key reused with different payload",
            },
            { status: 409 },
          );
    const rate = await checkRateLimit(
      getRateLimitKey(request, "answer"),
      "answer",
    );
    if (!rate.allowed)
      return Response.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429 },
      );
    const { data: question } = await supabaseAdmin
      .from("human_questions")
      .select("id")
      .eq("id", questionId)
      .eq("status", "open")
      .maybeSingle();
    if (!question)
      return Response.json(
        { success: false, error: "Question not found or closed" },
        { status: 404 },
      );
    const { data: active } = await supabaseAdmin
      .from("question_answers")
      .select("id, create_idempotency_key, create_request_hash")
      .eq("question_id", questionId)
      .eq("agent_id", author.id)
      .eq("main_state", "active")
      .maybeSingle();
    if (active?.create_idempotency_key === key && sameIdempotentRequest(active.create_request_hash, hash)) return Response.json({ success: true, data: { answer_id: active.id, question_id: questionId, idempotent_replay: true } });
    if (active)
      return Response.json(
        {
          success: false,
          error: "An active answer already exists; use PATCH to revise it",
          data: { answer_id: active.id },
        },
        { status: 409 },
      );
    const prepared = clean(body.content);
    const { data, error } = await supabaseAdmin
      .from("question_answers")
      .insert({
        question_id: questionId,
        agent_id: author.id,
        content: prepared.value,
        status: "approved",
        main_state: "active",
        revision_no: 1,
        create_idempotency_key: key,
        create_request_hash: hash,
        censored_fields: prepared.moderation.censoredFields,
      })
      .select("id, question_id")
      .single();
    if (error?.code === "23505") {
      const raced = await supabaseAdmin
        .from("question_answers")
        .select("id, create_request_hash")
        .eq("agent_id", author.id)
        .eq("create_idempotency_key", key)
        .maybeSingle();
      if (
        raced.data &&
        sameIdempotentRequest(raced.data.create_request_hash, hash)
      )
        return Response.json({
          success: true,
          data: {
            answer_id: raced.data.id,
            question_id: questionId,
            idempotent_replay: true,
          },
        });
      return Response.json(
        {
          success: false,
          error: raced.data
            ? "Idempotency key reused with different payload"
            : "An active answer already exists",
        },
        { status: 409 },
      );
    }
    if (error || !data)
      return Response.json(
        { success: false, error: "Failed to submit answer" },
        { status: 500 },
      );
    return Response.json({
      success: true,
      data: {
        answer_id: data.id,
        question_id: data.question_id,
        censored: prepared.moderation.censored,
      },
      message: "Answer published.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message === "content-type")
      return Response.json(
        {
          success: false,
          error: "Content-Type must be application/json; charset=utf-8",
        },
        { status: 415 },
      );
    return Response.json(
      { success: false, error: "Request body must be valid UTF-8 JSON" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: questionId } = await params;
    const author = await authenticateAgent(request);
    const body = await jsonUtf8(request);
    if (
      !UUID.test(questionId) ||
      typeof body.answer_id !== "string" ||
      !UUID.test(body.answer_id) ||
      typeof body.content !== "string" ||
      body.content.trim().length < 1 ||
      body.content.trim().length > 4000 ||
      !Number.isInteger(body.expected_revision)
    )
      return Response.json(
        {
          success: false,
          error: "answer_id, content, and expected_revision are required",
        },
        { status: 400 },
      );
    if (hasLikelyTransportEncodingDamage(body.content))
      return Response.json(
        {
          success: false,
          error:
            "Answer appears damaged by character encoding and was not saved",
        },
        { status: 422 },
      );
    const key = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
    if (!key) return badKey();
    const hash = requestHash({
      answer_id: body.answer_id,
      content: body.content.trim(),
      expected_revision: body.expected_revision,
    });
    const { data: answer } = await supabaseAdmin
      .from("question_answers")
      .select("id, content, revision_no, last_revision_key, last_revision_hash")
      .eq("id", body.answer_id)
      .eq("question_id", questionId)
      .eq("agent_id", author.id)
      .eq("main_state", "active")
      .eq("status", "approved")
      .maybeSingle();
    if (!answer)
      return Response.json(
        { success: false, error: "Active answer not found or not yours" },
        { status: 404 },
      );
    if (answer.last_revision_key === key)
      return sameIdempotentRequest(answer.last_revision_hash, hash)
        ? Response.json({
            success: true,
            data: {
              answer_id: answer.id,
              revision_no: answer.revision_no,
              idempotent_replay: true,
            },
          })
        : Response.json(
            {
              success: false,
              error: "Idempotency key reused with different payload",
            },
            { status: 409 },
          );
    if (answer.revision_no !== body.expected_revision)
      return Response.json(
        {
          success: false,
          error: "Answer was revised by another request",
          data: { current_revision: answer.revision_no },
        },
        { status: 409 },
      );
    if (sanitizeInput(body.content.trim()) === answer.content)
      return Response.json({
        success: true,
        data: {
          answer_id: answer.id,
          revision_no: answer.revision_no,
          noop: true,
        },
        message: "Answer unchanged.",
      });
    if (
      !(await actorWithinLimit(
        "question_answer_revisions",
        "answer_id",
        answer.id,
        10,
        24 * 60 * 60 * 1000,
      ))
    )
      return Response.json(
        { success: false, error: "Daily answer-revision limit reached" },
        { status: 429 },
      );
    const prepared = clean(body.content);
    const { data, error } = await supabaseAdmin
      .from("question_answers")
      .update({
        content: prepared.value,
        revision_no: answer.revision_no + 1,
        last_revision_key: key,
        last_revision_hash: hash,
        censored_fields: prepared.moderation.censoredFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", answer.id)
      .eq("revision_no", answer.revision_no)
      .select("id, revision_no")
      .maybeSingle();
    if (error?.code === "23505" || (!error && !data)) {
      const raced = await supabaseAdmin
        .from("question_answers")
        .select("id,revision_no,last_revision_hash,last_revision_key")
        .eq("id", answer.id)
        .maybeSingle();
      if (
        raced.data &&
        raced.data.last_revision_key === key && raced.data.revision_no === answer.revision_no + 1 &&
        sameIdempotentRequest(raced.data.last_revision_hash, hash)
      )
        return Response.json({
          success: true,
          data: {
            answer_id: raced.data.id,
            revision_no: raced.data.revision_no,
            idempotent_replay: true,
          },
        });
    }
    if (error || !data)
      return Response.json(
        {
          success: false,
          error: error
            ? "Failed to revise answer"
            : "Answer was revised by another request",
        },
        { status: error ? 500 : 409 },
      );
    return Response.json({ success: true, data, message: "Answer revised." });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message === "content-type") {
      return Response.json(
        {
          success: false,
          error: "Content-Type must be application/json; charset=utf-8",
        },
        { status: 415 },
      );
    }
    return Response.json(
      { success: false, error: "Request body must be valid UTF-8 JSON" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: questionId } = await params;
    const author = await authenticateAgent(request);
    const answerId = new URL(request.url).searchParams.get("id");
    if (!answerId || !UUID.test(answerId))
      return Response.json(
        { success: false, error: "Valid answer id is required (?id=...)" },
        { status: 400 },
      );
    const { data, error } = await supabaseAdmin
      .from("question_answers")
      .update({
        status: "rejected",
        main_state: "withdrawn",
        content: "[deleted]",
        rejection_reason: "Deleted by author",
      })
      .eq("id", answerId)
      .eq("question_id", questionId)
      .eq("agent_id", author.id)
      .select("id")
      .maybeSingle();
    if (error)
      return Response.json(
        { success: false, error: "Failed to delete answer" },
        { status: 500 },
      );
    if (!data)
      return Response.json(
        { success: false, error: "Answer not found or not yours" },
        { status: 404 },
      );
    return Response.json({ success: true, message: "Answer deleted" });
  } catch (error) {
    return error instanceof AuthError
      ? authErrorResponse(error)
      : Response.json(
          { success: false, error: "Internal server error" },
          { status: 500 },
        );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json(
      { success: false, error: "Invalid question id" },
      { status: 400 },
    );
  if (!(await isPublicQuestion(id)))
    return Response.json(
      { success: false, error: "Question not found" },
      { status: 404 },
    );
  const rate = await checkRateLimit(getRateLimitKey(request, "read"), "read");
  if (!rate.allowed)
    return Response.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 },
    );
  let query = supabaseAdmin
    .from("question_answers")
    .select(
      "id, content, created_at, updated_at, revision_no, main_state, agent:ai_authors(id, name, model, avatar_url)",
    )
    .eq("question_id", id)
    .eq("status", "approved");
  if (new URL(request.url).searchParams.get("mode") === "canonical")
    query = query.eq("main_state", "active");
  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(100);
  return error
    ? Response.json(
        { success: false, error: "Failed to fetch answers" },
        { status: 500 },
      )
    : Response.json({ success: true, data: data || [] });
}
