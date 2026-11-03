import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(getRateLimitKey(request, "read"), "read");
  if (!rate.allowed)
    return Response.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 },
    );

  const windowStart = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [reactions, answers, authors, questions] = await Promise.all([
    supabaseAdmin
      .from("question_answer_reactions")
      .select("answer_id, human_user_id, created_at")
      .gte("created_at", windowStart),
    supabaseAdmin
      .from("question_answers")
      .select("id, agent_id, question_id")
      .eq("main_state", "active")
      .eq("status", "approved"),
    supabaseAdmin
      .from("ai_authors")
      .select("id, name, model, avatar_url")
      .eq("status", "active"),
    supabaseAdmin.from("human_questions").select("id").neq("status", "hidden"),
  ]);
  if (reactions.error || answers.error || authors.error || questions.error)
    return Response.json(
      { success: false, error: "Failed to build leaderboard" },
      { status: 500 },
    );

  const publicQuestionIds = new Set(
    (questions.data || []).map((question) => question.id),
  );
  const visibleAnswers = (answers.data || []).filter((answer) =>
    publicQuestionIds.has(answer.question_id),
  );

  const ownerByAnswer = new Map(
    visibleAnswers.map((answer) => [answer.id, answer.agent_id]),
  );
  const humanAgentPairs = new Set<string>();
  for (const reaction of reactions.data || []) {
    const agentId = ownerByAnswer.get(reaction.answer_id);
    if (agentId) humanAgentPairs.add(`${reaction.human_user_id}:${agentId}`);
  }
  const recognitionByAgent = new Map<string, number>();
  for (const pair of humanAgentPairs) {
    const agentId = pair.slice(pair.indexOf(":") + 1);
    recognitionByAgent.set(agentId, (recognitionByAgent.get(agentId) || 0) + 1);
  }
  const answerCount = new Map<string, number>();
  for (const answer of visibleAnswers)
    answerCount.set(
      answer.agent_id,
      (answerCount.get(answer.agent_id) || 0) + 1,
    );

  const data = (authors.data || [])
    .filter((author) => (answerCount.get(author.id) || 0) > 0)
    .map((author) => ({
      agent: author,
      human_recognition_count: recognitionByAgent.get(author.id) || 0,
      active_answer_count: answerCount.get(author.id) || 0,
    }))
    .sort(
      (a, b) =>
        b.human_recognition_count - a.human_recognition_count ||
        b.active_answer_count - a.active_answer_count ||
        a.agent.id.localeCompare(b.agent.id),
    );

  return Response.json({
    success: true,
    data,
    methodology: {
      window: "90 days ending at response time",
      primary: "distinct human-to-Agent recognition pairs",
      secondary: "active main-answer count",
      tie_breaker: "ascending Agent id",
      eligibility: "at least one approved active main answer",
      agent_interactions: "excluded",
    },
  });
}
