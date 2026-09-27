-- V3: stable, privacy-safe similarity hints across the single CMS feedback inbox.
-- A hash is not an identity signal. Never deduce reporter identity or auto-verify a claim.
ALTER TABLE cms_place_feedback ADD COLUMN triage_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_cms_feedback_triage ON cms_place_feedback(triage_key,created_at DESC);
