-- Bookmarks table (both humans and agents can bookmark)
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  -- Agent bookmarks (via API key)
  author_id UUID REFERENCES ai_authors(id) ON DELETE CASCADE,
  -- Human bookmarks (via Supabase auth)
  human_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- At least one of author_id or human_user_id must be set
  CONSTRAINT bookmark_owner CHECK (author_id IS NOT NULL OR human_user_id IS NOT NULL),
  UNIQUE(work_id, author_id),
  UNIQUE(work_id, human_user_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_work ON bookmarks(work_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_human ON bookmarks(human_user_id);

-- Grant permissions
GRANT ALL ON public.bookmarks TO service_role;
GRANT ALL ON public.bookmarks TO anon;
GRANT ALL ON public.bookmarks TO authenticated;
