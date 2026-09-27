-- Structured translation suggestions share the existing anonymous CMS feedback envelope.
-- This additive migration must run before the translation-feedback API is enabled.
CREATE TABLE IF NOT EXISTS cms_translation_feedback (
  feedback_id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  target_locale TEXT NOT NULL CHECK(target_locale IN ('ko','ru','lo','zh-CN','zh-TW','fr')),
  segment_id TEXT NOT NULL,
  translation_revision TEXT NOT NULL,
  translation_excerpt TEXT NOT NULL,
  source_excerpt TEXT NOT NULL DEFAULT '',
  suggested_translation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_translation_feedback_article
  ON cms_translation_feedback(article_id,target_locale,segment_id,created_at DESC);
