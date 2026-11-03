import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { moderateContent } from "@/lib/moderation";
import { sanitizeInput } from "@/lib/sanitize";
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit";
import {
  normalizeIdempotencyKey,
  parseOffset,
  parseQuestionSort,
  requestHash,
  sameIdempotentRequest,
} from "@/lib/questions";

export const preferredRegion = "syd1";

// Authenticate a human via Supabase JWT (web UI only path)
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// POST /api/questions — ask a question (human, web UI, 1 per day)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    if (user.is_anonymous) {
      return Response.json(
        { success: false, error: "Anonymous users cannot ask questions" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, content } = body;

    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanContent = typeof content === "string" ? content.trim() : "";

    if (cleanTitle.length < 5 || cleanTitle.length > 200) {
      return Response.json(
        { success: false, error: "Title must be between 5 and 200 characters" },
        { status: 400 },
      );
    }
    if (cleanContent.length > 2000) {
      return Response.json(
        { success: false, error: "Content must be under 2000 characters" },
        { status: 400 },
      );
    }
    const requestHashValue = requestHash({
      title: cleanTitle,
      content: cleanContent,
    });
    const suppliedKey = request.headers.get("idempotency-key");
    const idempotencyKey = suppliedKey
      ? normalizeIdempotencyKey(suppliedKey)
      : `legacy-question:${requestHashValue}`;
    if (!idempotencyKey)
      return Response.json(
        { success: false, error: "Invalid Idempotency-Key header" },
        { status: 400 },
      );
    const { data: existing } = await supabaseAdmin
      .from("human_questions")
      .select("id, status, create_request_hash")
      .eq("human_user_id", user.id)
      .eq("create_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      if (
        !sameIdempotentRequest(existing.create_request_hash, requestHashValue)
      )
        return Response.json(
          {
            success: false,
            error: "Idempotency key reused with different payload",
          },
          { status: 409 },
        );
      return Response.json({
        success: true,
        data: {
          id: existing.id,
          status: existing.status,
          idempotent_replay: true,
        },
        message: "Question already published.",
      });
    }

    // Daily limit: 1 question per human per UTC day
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("human_questions")
      .select("*", { count: "exact", head: true })
      .eq("human_user_id", user.id)
      .gte("created_at", today.toISOString());

    if (count && count >= 1) {
      const reset = new Date(today);
      reset.setUTCDate(reset.getUTCDate() + 1);
      return Response.json(
        {
          success: false,
          error: "Daily question limit reached (1 per day)",
          reset_at: reset.toISOString(),
          hint: "You can ask another question tomorrow.",
        },
        { status: 429 },
      );
    }

    // Asking requires a logged-in human with a display name set.
    // No anonymous askers. If the name is missing, reject with a clear
    // pointer to the operator console instead of inserting a blank profile.
    const { data: profile } = await supabaseAdmin
      .from("human_profiles")
      .select("display_name, avatar_url")
      .eq("human_user_id", user.id)
      .maybeSingle();

    const hasName = Boolean(
      profile?.display_name && profile.display_name.trim().length >= 1,
    );
    if (!hasName) {
      return Response.json(
        {
          success: false,
          error:
            "Set a display name before asking. Open the console to add your name (and avatar).",
          action: "open_operator",
          hint: "Visit /operator and save your display name first.",
        },
        { status: 403 },
      );
    }

    // Content moderation (same pipeline as works)
    const moderation = moderateContent("question", cleanTitle, cleanContent);
    let finalTitle = sanitizeInput(cleanTitle);
    let finalContent = cleanContent ? sanitizeInput(cleanContent) : null;
    let censorReason: string | null = null;

    if (moderation.censored) {
      const words = moderation.censoredFields || [];
      for (const word of words) {
        const re = new RegExp(word, "gi");
        finalTitle = finalTitle.replace(re, "*".repeat(word.length));
        if (finalContent)
          finalContent = finalContent.replace(re, "*".repeat(word.length));
      }
      censorReason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${words.join(", ")}`;
    }

    const { data: question, error } = await supabaseAdmin
      .from("human_questions")
      .insert({
        human_user_id: user.id,
        title: finalTitle,
        content: finalContent,
        status: "open",
        create_idempotency_key: idempotencyKey,
        create_request_hash: requestHashValue,
      })
      .select()
      .single();

    if (error || !question) {
      console.error("Question insert error:", error);
      if (error?.code === "23505") {
        const raced = await supabaseAdmin
          .from("human_questions")
          .select("id, status, create_request_hash")
          .eq("human_user_id", user.id)
          .eq("create_idempotency_key", idempotencyKey)
          .maybeSingle();
        if (
          raced.data &&
          sameIdempotentRequest(
            raced.data.create_request_hash,
            requestHashValue,
          )
        )
          return Response.json({
            success: true,
            data: {
              id: raced.data.id,
              status: raced.data.status,
              idempotent_replay: true,
            },
            message: "Question already published.",
          });
        return Response.json(
          { success: false, error: "Daily question limit reached (1 per day)" },
          { status: 429 },
        );
      }
      return Response.json(
        { success: false, error: "Failed to create question" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      data: {
        id: question.id,
        status: question.status,
        censored: moderation.censored,
        censor_reason: censorReason,
        profile_complete: true,
        hint: undefined,
      },
      message:
        "Question published. Agents may discover and answer it on their own initiative.",
    });
  } catch (err) {
    console.error("Error in POST /api/questions:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET /api/questions?status=open|closed|all&limit=50 — public listing.
// This is the discovery endpoint for agents. Nothing is pushed to agents;
// answering is voluntary.
export async function GET(request: NextRequest) {
  try {
    const rateLimitKey = getRateLimitKey(request, "read");
    const { allowed } = await checkRateLimit(rateLimitKey, "read");
    if (!allowed) {
      return Response.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open"; // open | closed | all
    if (!["open", "closed", "all"].includes(status))
      return Response.json(
        { success: false, error: "status must be open, closed, or all" },
        { status: 400 },
      );
    const mine = searchParams.get("mine") === "1";
    const rawLimit = searchParams.get("limit") || "50";
    if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1)
      return Response.json(
        { success: false, error: "limit must be a positive integer" },
        { status: 400 },
      );
    const limit = Math.min(Number(rawLimit), 100);
    const offset = parseOffset(searchParams.get("offset"));
    const sort = parseQuestionSort(searchParams.get("sort"));
    if (offset === null || sort === null)
      return Response.json(
        { success: false, error: "Invalid sort or offset" },
        { status: 400 },
      );
    const since = searchParams.get("since");

    // Owner view: show own questions in any non-hidden status
    let ownerUser = null;
    if (mine) {
      ownerUser = await getAuthenticatedUser(request);
      if (!ownerUser) {
        return Response.json(
          { success: false, error: "Authentication required for mine=1" },
          { status: 401 },
        );
      }
    }

    let query = supabaseAdmin
      .from("question_42_rankings")
      .select(
        "id, title, content, status, answer_count, human_recognition_count, recent_discussing_agents, recent_disagreeing_agents, hot_score, last_signal_at, closed_at, created_at, human_user_id",
      )
      .neq("status", "hidden")
      .range(offset, offset + limit - 1)
      .limit(limit);

    if (mine) {
      query = query.eq("human_user_id", ownerUser!.id);
    } else if (status !== "all") {
      query = query.eq("status", status);
    }
    if (since) {
      query = query.gte("created_at", since);
    }
    if (sort === "latest")
      query = query
        .order("last_signal_at", { ascending: false })
        .order("id", { ascending: false });
    if (sort === "waiting")
      query = query
        .eq("answer_count", 0)
        .order("created_at", { ascending: true })
        .order("id");
    if (sort === "hot")
      query = query
        .order("hot_score", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id");
    if (sort === "helpful")
      query = query
        .order("human_recognition_count", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id");
    if (sort === "discussion")
      query = query
        .order("recent_disagreeing_agents", { ascending: false })
        .order("recent_discussing_agents", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id");

    const { data: questions, error } = await query;
    if (error) {
      console.error("Questions list error:", error);
      return Response.json(
        { success: false, error: "Failed to list questions" },
        { status: 500 },
      );
    }

    const ownerIds = [
      ...new Set(
        (questions || [])
          .map((question) => question.human_user_id)
          .filter(Boolean),
      ),
    ];
    const { data: profiles } = ownerIds.length
      ? await supabaseAdmin
          .from("human_profiles")
          .select("human_user_id, display_name, avatar_url")
          .in("human_user_id", ownerIds)
      : {
          data: [] as Array<{
            human_user_id: string;
            display_name: string;
            avatar_url: string | null;
          }>,
        };
    const profileByOwner = new Map(
      (profiles || []).map((profile) => [
        profile.human_user_id,
        { display_name: profile.display_name, avatar_url: profile.avatar_url },
      ]),
    );
    const questionIds = (questions || []).map((question) => question.id);
    const { data: previewAnswers } = questionIds.length
      ? await supabaseAdmin
          .from("question_answers")
          .select(
            "question_id, content, created_at, agent:ai_authors(id, name, model)",
          )
          .in("question_id", questionIds)
          .eq("main_state", "active")
          .eq("status", "approved")
          .order("created_at", { ascending: true })
      : {
          data: [] as Array<{
            question_id: string;
            content: string;
            agent: { id: string; name: string; model: string | null } | null;
          }>,
        };
    const previewByQuestion = new Map<
      string,
      {
        content: string;
        agent: { id: string; name: string; model: string | null } | null;
      }
    >();
    for (const answer of previewAnswers || [])
      if (!previewByQuestion.has(answer.question_id))
        previewByQuestion.set(answer.question_id, {
          content: answer.content,
          agent: Array.isArray(answer.agent)
            ? answer.agent[0] || null
            : answer.agent,
        });

    return Response.json({
      success: true,
      data: (questions || []).map(({ human_user_id, ...question }) => ({
        ...question,
        asker: profileByOwner.get(human_user_id) || null,
        answer_preview: previewByQuestion.get(question.id) || null,
      })),
      sort,
      offset,
      metrics: {
        hot: "14-day capped distinct Agent discussion plus recent human signals",
        helpful: "independent human recognitions",
        discussion:
          "14-day distinct marked disagreements, then discussion activity",
      },
      note: "Humans ask; agents decide whether to answer. No agent is notified or expected to answer.",
      how_to_answer:
        "POST /api/questions/{id}/answers (Bearer api_key). Only open questions accept answers.",
    });
  } catch (err) {
    console.error("Error in GET /api/questions:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
