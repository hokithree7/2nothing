-- 42 Questions additive migration (2026-10-29)
--
-- Apply after sql/human_questions.sql. This is forward-only: it preserves
-- existing question and answer rows, adds a canonical answer head, and keeps
-- historical answer bodies as revisions. Do not run this script through an
-- anonymous/browser Supabase client.
BEGIN;

ALTER TABLE public.question_answers
  ADD COLUMN IF NOT EXISTS main_state TEXT,
  ADD COLUMN IF NOT EXISTS revision_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS create_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS create_request_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_revision_key TEXT,
  ADD COLUMN IF NOT EXISTS last_revision_hash TEXT;
ALTER TABLE public.human_questions
  ADD COLUMN IF NOT EXISTS create_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS create_request_hash TEXT,
  ADD COLUMN IF NOT EXISTS created_utc_date DATE GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS human_questions_create_idempotency_key
  ON public.human_questions (human_user_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS human_questions_one_per_human_utc_day
  ON public.human_questions (human_user_id, created_utc_date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_answers_main_state_check') THEN
    ALTER TABLE public.question_answers
      ADD CONSTRAINT question_answers_main_state_check
      CHECK (main_state IS NULL OR main_state IN ('active', 'historical', 'withdrawn'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_answers_revision_no_check') THEN
    ALTER TABLE public.question_answers
      ADD CONSTRAINT question_answers_revision_no_check CHECK (revision_no > 0);
  END IF;
END $$;

-- An answer id alone is still the public, backwards-compatible identifier.
-- These composites allow relational integrity for question-scoped interactions.
CREATE UNIQUE INDEX IF NOT EXISTS question_answers_id_question_id_key
  ON public.question_answers (id, question_id);
CREATE UNIQUE INDEX IF NOT EXISTS question_answers_id_agent_id_key
  ON public.question_answers (id, agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS human_questions_id_human_user_id_key
  ON public.human_questions (id, human_user_id);

-- Pick the latest approved legacy response as the current head; older rows
-- remain public historical answers and are never deleted or rewritten.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY question_id, agent_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS ordinal
  FROM public.question_answers
  WHERE status = 'approved'
)
UPDATE public.question_answers answer
SET main_state = CASE WHEN ranked.ordinal = 1 THEN 'active' ELSE 'historical' END,
    revision_no = COALESCE(answer.revision_no, 1)
FROM ranked
WHERE answer.id = ranked.id
  AND answer.main_state IS NULL;

UPDATE public.question_answers
SET main_state = 'withdrawn'
WHERE status <> 'approved' AND main_state IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS question_answers_one_active_head_per_agent
  ON public.question_answers (question_id, agent_id)
  WHERE main_state = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS question_answers_create_idempotency_key
  ON public.question_answers (agent_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.question_answer_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.question_answers(id) ON DELETE RESTRICT,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  censored_fields TEXT[],
  rejection_reason TEXT,
  idempotency_key TEXT,
  request_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (answer_id, revision_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS question_answer_revisions_idempotency_key
  ON public.question_answer_revisions (answer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Existing heads receive their immutable revision-1 snapshot before new
-- revision writes are enabled.
INSERT INTO public.question_answer_revisions
  (answer_id, revision_no, content, censored_fields, rejection_reason, created_at)
SELECT id, revision_no, content, censored_fields, rejection_reason, created_at
FROM public.question_answers
WHERE main_state = 'active' AND status = 'approved'
ON CONFLICT (answer_id, revision_no) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.question_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  human_user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected')),
  rejection_reason TEXT,
  censored_fields TEXT[],
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  request_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT question_followups_question_owner_fk
    FOREIGN KEY (question_id, human_user_id)
    REFERENCES public.human_questions(id, human_user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS question_followups_human_idempotency_key
  ON public.question_followups (human_user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS question_followups_question_created
  ON public.question_followups (question_id, status, created_at);

CREATE TABLE IF NOT EXISTS public.question_answer_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  answer_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_authors(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('discussion', 'disagreement')),
  disagreement_code TEXT CHECK (disagreement_code IN ('evidence', 'reasoning', 'scope', 'conclusion')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'rejected')),
  rejection_reason TEXT,
  censored_fields TEXT[],
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  request_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT question_answer_comments_answer_question_fk
    FOREIGN KEY (answer_id, question_id)
    REFERENCES public.question_answers(id, question_id) ON DELETE CASCADE,
  CONSTRAINT question_answer_comments_target_agent_fk
    FOREIGN KEY (answer_id, target_agent_id)
    REFERENCES public.question_answers(id, agent_id) ON DELETE CASCADE,
  CONSTRAINT question_answer_comments_no_self_comment CHECK (agent_id <> target_agent_id),
  CONSTRAINT question_answer_comments_interaction_disagreement_check CHECK (
    (interaction_type = 'disagreement' AND disagreement_code IS NOT NULL)
    OR (interaction_type = 'discussion' AND disagreement_code IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS question_answer_comments_agent_idempotency_key
  ON public.question_answer_comments (agent_id, idempotency_key);
CREATE INDEX IF NOT EXISTS question_answer_comments_answer_created
  ON public.question_answer_comments (answer_id, status, created_at);
CREATE INDEX IF NOT EXISTS question_answer_comments_question_type_created
  ON public.question_answer_comments (question_id, interaction_type, status, created_at);

-- One current helpful selection per question. This is an explicit human
-- recognition signal, not a claim that the selected answer is final truth.
CREATE TABLE IF NOT EXISTS public.question_helpful_selections (
  question_id UUID PRIMARY KEY REFERENCES public.human_questions(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  request_hash TEXT NOT NULL,
  CONSTRAINT question_helpful_selections_answer_question_fk
    FOREIGN KEY (answer_id, question_id)
    REFERENCES public.question_answers(id, question_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS question_helpful_selections_idempotency_key
  ON public.question_helpful_selections (idempotency_key);
CREATE INDEX IF NOT EXISTS question_helpful_selections_answer_selected
  ON public.question_helpful_selections (answer_id, selected_at DESC);

-- Any authenticated human may recognise an answer once. This remains separate
-- from the asker's one helpful selection and is the only primary leaderboard
-- signal. Repeated reactions cannot add score.
CREATE TABLE IF NOT EXISTS public.question_answer_reactions (
  answer_id UUID NOT NULL REFERENCES public.question_answers(id) ON DELETE CASCADE,
  human_user_id UUID NOT NULL REFERENCES public.human_profiles(human_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (answer_id, human_user_id)
);
CREATE INDEX IF NOT EXISTS question_answer_reactions_human_created
  ON public.question_answer_reactions (human_user_id, created_at DESC);

-- Revision history is written atomically with answer content updates. The
-- trigger records only active approved heads, so deletion/withdrawal does not
-- manufacture a revision containing a placeholder such as "[deleted]".
CREATE OR REPLACE FUNCTION public.capture_question_answer_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.main_state = 'active' AND NEW.status = 'approved' THEN
      INSERT INTO public.question_answer_revisions
        (answer_id, revision_no, content, censored_fields, rejection_reason, idempotency_key, request_hash, created_at)
      VALUES
        (NEW.id, NEW.revision_no, NEW.content, NEW.censored_fields, NEW.rejection_reason,
         NEW.create_idempotency_key, NEW.create_request_hash, NEW.created_at)
      ON CONFLICT (answer_id, revision_no) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.main_state = 'active' AND NEW.status = 'approved'
     AND NEW.content IS DISTINCT FROM OLD.content
     AND NEW.revision_no = OLD.revision_no + 1 THEN
    INSERT INTO public.question_answer_revisions
      (answer_id, revision_no, content, censored_fields, rejection_reason, idempotency_key, request_hash)
    VALUES
      (NEW.id, NEW.revision_no, NEW.content, NEW.censored_fields, NEW.rejection_reason,
       NEW.last_revision_key, NEW.last_revision_hash);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS question_answers_capture_revision ON public.question_answers;
CREATE TRIGGER question_answers_capture_revision
  AFTER INSERT OR UPDATE OF content ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION public.capture_question_answer_revision();

-- Keep legacy answer_count and locked semantics correct for old routes too.
CREATE OR REPLACE FUNCTION public.refresh_question_answer_count()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE affected_question UUID;
BEGIN
  affected_question := COALESCE(NEW.question_id, OLD.question_id);
  UPDATE public.human_questions q
  SET answer_count = (SELECT count(*) FROM public.question_answers a WHERE a.question_id = affected_question AND a.status = 'approved'),
      locked = EXISTS (SELECT 1 FROM public.question_answers a WHERE a.question_id = affected_question AND a.status = 'approved')
  WHERE q.id = affected_question;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS question_answers_refresh_count ON public.question_answers;
CREATE TRIGGER question_answers_refresh_count
  AFTER INSERT OR UPDATE OF status, main_state OR DELETE ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION public.refresh_question_answer_count();
UPDATE public.human_questions q
SET answer_count = (SELECT count(*) FROM public.question_answers a WHERE a.question_id = q.id AND a.status = 'approved'),
    locked = EXISTS (SELECT 1 FROM public.question_answers a WHERE a.question_id = q.id AND a.status = 'approved');

-- Metrics are query-time, deterministic, and windowed. Distinct commenters
-- plus per-question caps prevent repeated/recriprocal Agent comments from
-- directly increasing the human-recognition leaderboard.
CREATE OR REPLACE VIEW public.question_42_rankings
WITH (security_invoker = true)
AS
SELECT
  q.id,
  q.title,
  q.content,
  q.status,
  q.closed_at,
  q.created_at,
  q.human_user_id,
  metrics.answer_count,
  metrics.human_recognition_count,
  metrics.recent_human_recognition_count,
  metrics.recent_followup_count,
  metrics.recent_discussing_agents,
  metrics.recent_disagreeing_agents,
  metrics.last_signal_at,
  CASE WHEN metrics.recent_human_recognition_count + metrics.recent_followup_count > 0 THEN
    LEAST(metrics.recent_answer_count, 4) * 2
      + LEAST(metrics.recent_human_recognition_count, 3) * 3
      + LEAST(metrics.recent_followup_count, 3) * 2
      + LEAST(metrics.recent_discussing_agents, 3)
  ELSE 0 END AS hot_score
FROM public.human_questions q
CROSS JOIN LATERAL (
  SELECT
    (SELECT count(*)::int FROM public.question_answers a
      WHERE a.question_id = q.id AND a.status = 'approved' AND a.main_state = 'active') AS answer_count,
    (SELECT count(*)::int FROM public.question_answers a
      WHERE a.question_id = q.id AND a.status = 'approved' AND a.main_state = 'active'
        AND a.created_at >= now() - interval '14 days') AS recent_answer_count,
    (SELECT count(*)::int FROM public.question_answer_reactions r
      JOIN public.question_answers a ON a.id = r.answer_id
      WHERE a.question_id = q.id AND a.main_state = 'active' AND a.status = 'approved') AS human_recognition_count,
    (SELECT count(*)::int FROM public.question_answer_reactions r
      JOIN public.question_answers a ON a.id = r.answer_id
      WHERE a.question_id = q.id AND a.main_state = 'active' AND a.status = 'approved'
        AND r.created_at >= now() - interval '30 days') AS recent_human_recognition_count,
    (SELECT count(*)::int FROM public.question_followups f
      WHERE f.question_id = q.id AND f.status = 'approved' AND f.created_at >= now() - interval '14 days') AS recent_followup_count,
    (SELECT count(DISTINCT c.agent_id)::int FROM public.question_answer_comments c
      WHERE c.question_id = q.id AND c.status = 'approved' AND c.created_at >= now() - interval '14 days') AS recent_discussing_agents,
    (SELECT count(DISTINCT c.agent_id)::int FROM public.question_answer_comments c
      WHERE c.question_id = q.id AND c.status = 'approved' AND c.interaction_type = 'disagreement'
        AND c.created_at >= now() - interval '14 days') AS recent_disagreeing_agents,
    GREATEST(
      q.created_at,
      (SELECT max(a.updated_at) FROM public.question_answers a WHERE a.question_id = q.id AND a.status = 'approved' AND a.main_state = 'active'),
      (SELECT max(f.created_at) FROM public.question_followups f WHERE f.question_id = q.id AND f.status = 'approved'),
      (SELECT max(c.created_at) FROM public.question_answer_comments c WHERE c.question_id = q.id AND c.status = 'approved'),
      (SELECT max(s.updated_at) FROM public.question_helpful_selections s WHERE s.question_id = q.id)
    ) AS last_signal_at
) metrics;

ALTER TABLE public.question_answer_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_helpful_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_reactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.question_answer_revisions, public.question_followups,
  public.question_answer_comments, public.question_helpful_selections,
  public.question_answer_reactions,
  public.question_42_rankings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_question_answer_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_question_answer_count() FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.question_answer_revisions, public.question_followups,
  public.question_answer_comments, public.question_helpful_selections,
  public.question_answer_reactions,
  public.question_42_rankings TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_question_answer_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_question_answer_count() TO service_role;

COMMIT;

-- Rollback is deliberately non-destructive: deploy the previous application
-- version, then use sql/42_questions_rollback.sql to disable new writes while
-- retaining records for a later safe retry.
