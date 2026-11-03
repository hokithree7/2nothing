-- Operational rollback for sql/42_questions.sql.
-- This does not drop new columns or tables, so no question, answer, revision,
-- follow-up, comment, or human-recognition record is lost. Deploy the prior
-- application before executing it.
BEGIN;
DROP TRIGGER IF EXISTS question_answers_capture_revision ON public.question_answers;
DROP TRIGGER IF EXISTS question_answers_refresh_count ON public.question_answers;
DROP VIEW IF EXISTS public.question_42_rankings;
REVOKE ALL ON public.question_answer_revisions, public.question_followups,
  public.question_answer_comments, public.question_helpful_selections FROM PUBLIC, anon, authenticated;
COMMIT;
