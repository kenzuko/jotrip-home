CREATE TABLE IF NOT EXISTS currency_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  currency TEXT NOT NULL,
  name TEXT,
  cash_buy REAL,
  transfer_buy REAL,
  sell REAL,
  UNIQUE(source_updated_at, currency)
);

CREATE INDEX IF NOT EXISTS idx_currency_snapshots_currency_time
ON currency_snapshots(currency, fetched_at);

CREATE INDEX IF NOT EXISTS idx_currency_snapshots_source_time
ON currency_snapshots(source_updated_at);
