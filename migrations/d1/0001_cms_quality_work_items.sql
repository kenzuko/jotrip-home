-- Additive CMS-only persistence for the quality task center.
-- Existing analytics, weather feedback, transit, sea-load and aviation tables stay untouched.
CREATE TABLE IF NOT EXISTS cms_quality_work_items (
  task_key TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  entity_id TEXT,
  field TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'muted')),
  owner TEXT,
  due_at TEXT,
  muted_until TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cms_quality_work_items_status_updated
  ON cms_quality_work_items(status, updated_at);

CREATE INDEX IF NOT EXISTS cms_quality_work_items_owner_status
  ON cms_quality_work_items(owner, status);

CREATE TABLE IF NOT EXISTS cms_quality_audit_events (
  event_id TEXT PRIMARY KEY,
  task_key TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cms_quality_audit_task_created
  ON cms_quality_audit_events(task_key, created_at);
