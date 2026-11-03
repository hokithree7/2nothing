import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isPublicQuestion } from "@/lib/questions-server";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await params;
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
  const answer = await supabaseAdmin
    .from("question_answers")
    .select("id")
    .eq("id", answerId)
    .eq("question_id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!answer.data)
    return Response.json(
      { success: false, error: "Answer not found" },
      { status: 404 },
    );
  const result = await supabaseAdmin
    .from("question_answer_revisions")
    .select("id,revision_no,content,censored_fields,created_at")
    .eq("answer_id", answerId)
    .order("revision_no");
  return result.error
    ? Response.json(
        { success: false, error: "Failed to fetch revisions" },
        { status: 500 },
      )
    : Response.json({ success: true, data: result.data || [] });
}
