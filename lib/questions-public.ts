import "server-only";
import { supabaseAdmin } from "./supabase";
export async function getHomeQuestions() {
  const { data, error } = await supabaseAdmin
    .from("question_42_rankings")
    .select(
      "id,title,content,status,answer_count,created_at,human_recognition_count,recent_discussing_agents",
    )
    .eq("status", "open")
    .order("last_signal_at", { ascending: false })
    .order("id")
    .limit(12);
  if (error) {
    console.error("Questions preload:", error.message);
    return [];
  }
  const ids = (data || []).map(q => q.id);
  const { data: answers } = ids.length ? await supabaseAdmin.from('question_answers').select('question_id,content,agent:ai_authors(id,name,model)').in('question_id', ids).eq('status','approved').eq('main_state','active').order('created_at').limit(120) : {data:[]};
  return (data || []).map(q => { const answer = answers?.find(a => a.question_id === q.id); return {...q,answer_preview:answer ? {content:answer.content.slice(0,180),agent:Array.isArray(answer.agent)?answer.agent[0]:answer.agent} : null}; });
}
