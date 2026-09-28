-- Additive CMS server-side draft persistence.
-- Drafts stay in D1 and never create GitHub commits until the existing publish/direct-save flow runs.
CREATE TABLE IF NOT EXISTS cms_drafts (
  draft_key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  module_id TEXT NOT NULL,
  path TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  data_json TEXT NOT NULL,
  last_revision_id TEXT,
  last_checkpoint_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cms_drafts_actor_updated
  ON cms_drafts(actor, updated_at);

CREATE INDEX IF NOT EXISTS cms_drafts_path_updated
  ON cms_drafts(path, updated_at);

CREATE TABLE IF NOT EXISTS cms_draft_revisions (
  revision_id TEXT PRIMARY KEY,
  draft_key TEXT NOT NULL,
  actor TEXT NOT NULL,
  module_id TEXT NOT NULL,
  path TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cms_draft_revisions_draft_created
  ON cms_draft_revisions(draft_key, created_at DESC);

CREATE TABLE IF NOT EXISTS cms_draft_audit (
  event_id TEXT PRIMARY KEY,
  draft_key TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('save','restore','clear')),
  revision_id TEXT,
  base_sha TEXT,
  created_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cms_draft_audit_draft_created
  ON cms_draft_audit(draft_key, created_at DESC);
