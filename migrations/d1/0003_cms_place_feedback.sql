-- Apply once to openpq-cms D1 before enabling public intake.
-- Store no raw IP, email, GPS of reporters or user credentials.
CREATE TABLE IF NOT EXISTS cms_place_feedback (
  id TEXT PRIMARY KEY,
  issue TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  source_path TEXT NOT NULL,
  image_key TEXT,
  image_mime TEXT,
  submit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','resolved','rejected')),
  moderator_note TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_cms_place_feedback_queue ON cms_place_feedback(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_place_feedback_limit ON cms_place_feedback(submit_hash,created_at DESC);
