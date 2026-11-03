import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  normalizeIdempotencyKey,
  requestHash,
  sameIdempotentRequest,
} from "@/lib/questions";

async function human(request: NextRequest) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ")
    ? (await supabaseAdmin.auth.getUser(auth.slice(7))).data.user
    : null;
}
async function owner(id: string, userId: string) {
  return (
    await supabaseAdmin
      .from("human_questions")
      .select("id")
      .eq("id", id)
      .eq("human_user_id", userId)
      .neq("status", "hidden")
      .maybeSingle()
  ).data;
}
async function limited(userId: string) {
  return !(await checkRateLimit(`human:${userId}:helpful`, "default")).allowed;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await params;
  const user = await human(request);
  if (!user)
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  if (user.is_anonymous)
    return Response.json(
      {
        success: false,
        error: "Anonymous users cannot select helpful answers",
      },
      { status: 403 },
    );
  if (!(await owner(id, user.id)))
    return Response.json(
      { success: false, error: "Question not found or not yours" },
      { status: 404 },
    );
  const key = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
  if (!key)
    return Response.json(
      { success: false, error: "A valid Idempotency-Key header is required" },
      { status: 400 },
    );
  const hash = requestHash({ question_id: id, answer_id: answerId });
  const prior = await supabaseAdmin
    .from("question_helpful_selections")
    .select("answer_id,idempotency_key,request_hash,updated_at")
    .eq("question_id", id)
    .maybeSingle();
  if (prior.data?.idempotency_key === key)
    return sameIdempotentRequest(prior.data.request_hash, hash)
      ? Response.json({
          success: true,
          data: {
            helpful_answer_id: prior.data.answer_id,
            selected_at: prior.data.updated_at,
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
  if (await limited(user.id))
    return Response.json(
      { success: false, error: "Helpful-selection rate limit exceeded" },
      { status: 429 },
    );
  const answer = await supabaseAdmin
    .from("question_answers")
    .select("id")
    .eq("id", answerId)
    .eq("question_id", id)
    .eq("main_state", "active")
    .eq("status", "approved")
    .maybeSingle();
  if (!answer.data)
    return Response.json(
      { success: false, error: "Active answer not found" },
      { status: 404 },
    );
  const result = await supabaseAdmin
    .from("question_helpful_selections")
    .upsert(
      {
        question_id: id,
        answer_id: answerId,
        idempotency_key: key,
        request_hash: hash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "question_id" },
    )
    .select("answer_id,updated_at")
    .single();
  return result.error
    ? Response.json(
        { success: false, error: "Failed to mark helpful" },
        { status: 500 },
      )
    : Response.json({
        success: true,
        data: {
          helpful_answer_id: result.data.answer_id,
          selected_at: result.data.updated_at,
        },
      });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await params;
  const user = await human(request);
  if (!user)
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  if (user.is_anonymous)
    return Response.json(
      { success: false, error: "Anonymous users cannot clear helpful answers" },
      { status: 403 },
    );
  if (!(await owner(id, user.id)))
    return Response.json(
      { success: false, error: "Question not found or not yours" },
      { status: 404 },
    );
  if (await limited(user.id))
    return Response.json(
      { success: false, error: "Helpful-selection rate limit exceeded" },
      { status: 429 },
    );
  const result = await supabaseAdmin
    .from("question_helpful_selections")
    .delete()
    .eq("question_id", id)
    .eq("answer_id", answerId);
  return result.error
    ? Response.json(
        { success: false, error: "Failed to clear helpful selection" },
        { status: 500 },
      )
    : Response.json({ success: true, data: { helpful_answer_id: null } });
}
