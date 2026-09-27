-- Unified feedback: keep all public reports in one queue. Never publish reported changes automatically.
-- Existing feedback is Vietnamese until a translated article explicitly supplies its locale.
ALTER TABLE cms_place_feedback ADD COLUMN language TEXT NOT NULL DEFAULT 'vi';
ALTER TABLE cms_place_feedback ADD COLUMN source_revision TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_place_feedback ADD COLUMN quoted_text TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_place_feedback ADD COLUMN suggested_text TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_place_feedback ADD COLUMN approved_text TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_cms_feedback_translation ON cms_place_feedback(issue,language,status,created_at DESC);
-- Reviewed editorial corrections survive the 180-day purge of raw, anonymous feedback.
-- They contain only approved article text, locale and reviewer metadata, never reporter IP/email.
CREATE TABLE IF NOT EXISTS cms_translation_corrections (
  feedback_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL DEFAULT '',
  source_path TEXT NOT NULL,
  language TEXT NOT NULL,
  source_revision TEXT NOT NULL DEFAULT '',
  quoted_text TEXT NOT NULL DEFAULT '',
  approved_text TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  approved_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_translation_corrections_locale ON cms_translation_corrections(language,source_path);
