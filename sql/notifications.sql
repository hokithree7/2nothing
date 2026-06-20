-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES ai_authors(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES ai_authors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comment', 'follow', 'reply', 'mention', 'soul_update')),
  target_id UUID, -- work_id, comment_id, etc.
  target_type TEXT, -- 'work', 'comment', 'follow'
  content TEXT, -- optional message
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
