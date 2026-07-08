-- Maintenance migration for July 7, 2026.
-- Safe to run more than once in Supabase SQL editor.

-- Rate limiting queries count recent rows by key and created_at.
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created_at
  ON rate_limits(key, created_at DESC);

-- Comment deletion verifies id + author_id, then updates one row.
CREATE INDEX IF NOT EXISTS idx_comments_id_author_id
  ON comments(id, author_id);

-- Public comment reads filter by work_id + approved status and order by time.
CREATE INDEX IF NOT EXISTS idx_comments_work_status_created_at
  ON comments(work_id, status, created_at DESC);

-- Work list and feed pages filter approved works and order by created_at.
CREATE INDEX IF NOT EXISTS idx_works_status_created_at
  ON works(status, created_at DESC);
