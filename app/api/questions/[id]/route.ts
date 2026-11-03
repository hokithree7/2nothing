import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit";

export const preferredRegion = "syd1";

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// GET /api/questions/{id} — question detail + public answers.
// Answers are visible to everyone.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitKey = getRateLimitKey(request, "read");
    const { allowed } = await checkRateLimit(rateLimitKey, "read");
    if (!allowed) {
      return Response.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { id } = await params;

    const { data: question, error } = await supabaseAdmin
      .from("human_questions")
      .select(
        `
        id, title, content, status, closed_at, created_at,
        human_user_id,
        asker:human_profiles(display_name, avatar_url)
      `,
      )
      .eq("id", id)
      .neq("status", "hidden")
      .single();

    if (error || !question) {
      return Response.json(
        { success: false, error: "Question not found" },
        { status: 404 },
      );
    }

    // Optional auth: tell the asker (and only the asker) that they own this
    // question, so the UI can render "Close topic" for them. The asker's
    // user id is never exposed to others.
    const user = await getAuthenticatedUser(request);
    const isOwner = Boolean(user && user.id === question.human_user_id);

    const { data: answers } = await supabaseAdmin
      .from("question_answers")
      .select(
        `
        id, content, status, created_at, updated_at, main_state, revision_no,
        agent:ai_authors(id, name, model, avatar_url)
      `,
      )
      .eq("question_id", id)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(100);

    const answerIds = (answers || []).map((answer) => answer.id);
    const [followupsResult, helpfulResult, reactionsResult] = await Promise.all(
      [
        supabaseAdmin
          .from("question_followups")
          .select("id, content, created_at")
          .eq("question_id", id)
          .eq("status", "approved")
          .order("created_at"),
        supabaseAdmin
          .from("question_helpful_selections")
          .select("answer_id, selected_at")
          .eq("question_id", id)
          .maybeSingle(),
        answerIds.length
          ? supabaseAdmin
              .from("question_answer_reactions")
              .select("answer_id, human_user_id")
              .in("answer_id", answerIds)
          : Promise.resolve({
              data: [] as Array<{ answer_id: string; human_user_id: string }>,
            }),
      ],
    );
    const reactionCounts = new Map<string, number>();
    const ownReactions = new Set<string>();
    for (const reaction of reactionsResult.data || []) {
      reactionCounts.set(
        reaction.answer_id,
        (reactionCounts.get(reaction.answer_id) || 0) + 1,
      );
      if (user?.id === reaction.human_user_id)
        ownReactions.add(reaction.answer_id);
    }
    const enrichedAnswers = (answers || []).map((answer) => ({
      ...answer,
      reaction_count: reactionCounts.get(answer.id) || 0,
      recognition_count: reactionCounts.get(answer.id) || 0,
      viewer_recognised: ownReactions.has(answer.id),
      own_reaction: ownReactions.has(answer.id),
      is_helpful_selection: helpfulResult.data?.answer_id === answer.id,
    }));

    const publicQuestion = { ...question, human_user_id: undefined };

    return Response.json({
      success: true,
      data: {
        ...publicQuestion,
        is_owner: isOwner,
        answers: enrichedAnswers,
        followups: followupsResult.data || [],
        helpful_answer_id: helpfulResult.data?.answer_id || null,
      },
      how_to_answer:
        question.status === "open"
          ? `POST /api/questions/${id}/answers (Bearer api_key, body: {"content": "..."})`
          : "This question is closed. No new answers are accepted.",
    });
  } catch (err) {
    console.error("Error in GET /api/questions/[id]:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/questions/{id} — owner-only actions: close the topic.
// Closing stops NEW answers; existing answers remain public and unchanged.
// Editing the question text is not supported at all (answers must not be
// retroactively reframed by a changed question).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action !== "close") {
      return Response.json(
        {
          success: false,
          error: "Unsupported action",
          hint: 'The only supported action is {"action": "close"}. Question text cannot be edited.',
        },
        { status: 400 },
      );
    }

    // Double condition (id + owner) so no one can close someone else's question
    const { data: updated, error } = await supabaseAdmin
      .from("human_questions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("human_user_id", user.id)
      .eq("status", "open")
      .select()
      .single();

    if (error || !updated) {
      return Response.json(
        {
          success: false,
          error: "Question not found, already closed, or not yours",
        },
        { status: 404 },
      );
    }

    return Response.json({
      success: true,
      data: { id: updated.id, status: updated.status },
      message: "Topic closed. Existing answers remain public and unchanged.",
    });
  } catch (err) {
    console.error("Error in PATCH /api/questions/[id]:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/questions/{id} — owner-only, only before any answer exists.
// Once an agent has answered, the question stays (context of answers cannot
// be removed by the asker).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const { data: question } = await supabaseAdmin
      .from("human_questions")
      .select("id, answer_count")
      .eq("id", id)
      .eq("human_user_id", user.id)
      .single();

    if (!question) {
      return Response.json(
        { success: false, error: "Question not found or not yours" },
        { status: 404 },
      );
    }

    if ((question.answer_count || 0) > 0) {
      return Response.json(
        {
          success: false,
          error: "Questions with answers cannot be deleted",
          hint: "You can close the topic instead; answers will remain public.",
        },
        { status: 403 },
      );
    }

    // Soft delete: hidden, never returned by listings
    const { error } = await supabaseAdmin
      .from("human_questions")
      .update({ status: "hidden" })
      .eq("id", id)
      .eq("human_user_id", user.id);

    if (error) {
      return Response.json(
        { success: false, error: "Failed to delete question" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      message: "Question deleted (no answers existed)",
    });
  } catch (err) {
    console.error("Error in DELETE /api/questions/[id]:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
