import { supabaseAdmin } from "@/lib/supabase";

export async function isPublicQuestion(questionId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("human_questions")
    .select("id")
    .eq("id", questionId)
    .neq("status", "hidden")
    .maybeSingle();
  return Boolean(data);
}

export async function actorWithinLimit(
  table: string,
  actorColumn: string,
  actorId: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(actorColumn, actorId)
    .gte("created_at", new Date(Date.now() - windowMs).toISOString());
  return !error && (count || 0) < max;
}
