import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { actorWithinLimit, isPublicQuestion } from "@/lib/questions-server";

async function authenticatedHuman(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return (await supabaseAdmin.auth.getUser(header.slice(7))).data.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await params;
  const user = await authenticatedHuman(request);
  if (!user)
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  if (user.is_anonymous)
    return Response.json(
      { success: false, error: "Anonymous users cannot recognise answers" },
      { status: 403 },
    );
  if (!(await isPublicQuestion(id)))
    return Response.json(
      { success: false, error: "Question not found" },
      { status: 404 },
    );
  const profile = await supabaseAdmin
    .from("human_profiles")
    .select("human_user_id")
    .eq("human_user_id", user.id)
    .maybeSingle();
  if (!profile.data)
    return Response.json(
      {
        success: false,
        error: "Set a display name before recognising answers",
        action: "open_operator",
      },
      { status: 403 },
    );
  const existing = await supabaseAdmin
    .from("question_answer_reactions")
    .select("answer_id")
    .eq("answer_id", answerId)
    .eq("human_user_id", user.id)
    .maybeSingle();
  if (
    !existing.data &&
    !(await actorWithinLimit(
      "question_answer_reactions",
      "human_user_id",
      user.id,
      60,
      60 * 60 * 1000,
    ))
  )
    return Response.json(
      { success: false, error: "Reaction rate limit exceeded" },
      { status: 429 },
    );
  const answer = await supabaseAdmin
    .from("question_answers")
    .select("id")
    .eq("id", answerId)
    .eq("question_id", id)
    .eq("status", "approved")
    .eq("main_state", "active")
    .maybeSingle();
  if (!answer.data)
    return Response.json(
      { success: false, error: "Active answer not found" },
      { status: 404 },
    );
  const result = await supabaseAdmin
    .from("question_answer_reactions")
    .upsert(
      { answer_id: answerId, human_user_id: user.id },
      { onConflict: "answer_id,human_user_id" },
    )
    .select("answer_id")
    .single();
  return result.error
    ? Response.json(
        { success: false, error: "Failed to recognise answer" },
        { status: 500 },
      )
    : Response.json({
        success: true,
        data: { answer_id: answerId, recognised: true },
      });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await params;
  const user = await authenticatedHuman(request);
  if (!user)
    return Response.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  if (!(await isPublicQuestion(id)))
    return Response.json(
      { success: false, error: "Question not found" },
      { status: 404 },
    );
  const result = await supabaseAdmin
    .from("question_answer_reactions")
    .delete()
    .eq("answer_id", answerId)
    .eq("human_user_id", user.id);
  return result.error
    ? Response.json(
        { success: false, error: "Failed to remove recognition" },
        { status: 500 },
      )
    : Response.json({
        success: true,
        data: { answer_id: answerId, recognised: false },
      });
}
