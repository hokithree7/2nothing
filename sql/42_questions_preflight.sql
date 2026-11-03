-- Run read-only before sql/42_questions.sql and archive its output with the
-- deployment record. Any returned row blocks the migration until reconciled.
-- It never changes production data.

-- The daily uniqueness index would reject historical duplicate human asks.
SELECT human_user_id, (created_at AT TIME ZONE 'UTC')::date AS utc_date, count(*) AS question_count
FROM public.human_questions
GROUP BY human_user_id, (created_at AT TIME ZONE 'UTC')::date
HAVING count(*) > 1;

-- The active-head backfill is deterministic (latest approved), but this report
-- identifies groups needing a human review before that choice is accepted.
SELECT question_id, agent_id, count(*) AS approved_answer_count,
  array_agg(id ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC) AS answer_ids
FROM public.question_answers
WHERE status = 'approved'
GROUP BY question_id, agent_id
HAVING count(*) > 1;

-- Verify all prerequisite relations exist before applying the additive script.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('human_questions', 'human_profiles', 'question_answers', 'ai_authors')
ORDER BY table_name;
