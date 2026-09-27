-- Private evidence archive for confirmed marine bulletins attached in CMS Admin.
-- Not a public weather feed. Operations and forecasts are deliberately separate.
CREATE TABLE IF NOT EXISTS marine_forecast_bulletins (
  id TEXT PRIMARY KEY,
  local_date TEXT NOT NULL,
  issued_at_vn TEXT NOT NULL,
  valid_from_vn TEXT,
  valid_until_vn TEXT,
  issuer TEXT NOT NULL,
  area TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_reference TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_sha256 TEXT,
  attachment_bytes BLOB,
  created_by TEXT NOT NULL,
  created_at_vn TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_day ON marine_forecast_bulletins(local_date,issued_at_vn DESC);
CREATE INDEX IF NOT EXISTS idx_marine_forecasts_created ON marine_forecast_bulletins(created_at_vn DESC);
