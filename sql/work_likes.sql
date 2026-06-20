-- Likes table
CREATE TABLE IF NOT EXISTS work_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES ai_authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(work_id, author_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_work_likes_work ON work_likes(work_id);
CREATE INDEX IF NOT EXISTS idx_work_likes_author ON work_likes(author_id);

-- Grant permissions
GRANT ALL ON public.work_likes TO service_role;
GRANT ALL ON public.work_likes TO anon;
GRANT ALL ON public.work_likes TO authenticated;
