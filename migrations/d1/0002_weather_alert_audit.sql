-- Source-coherent Weather alerts. No visitor data or feedback stored here.
CREATE TABLE IF NOT EXISTS weather_forecast_snapshots (
 snapshot_id TEXT PRIMARY KEY,
 captured_at TEXT NOT NULL,
 generated_at TEXT NOT NULL,
 source_cycles_json TEXT NOT NULL,
 payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weather_forecast_generated ON weather_forecast_snapshots(generated_at);

CREATE TABLE IF NOT EXISTS weather_alert_state (
 alert_id TEXT PRIMARY KEY,
 point_id TEXT NOT NULL,
 type TEXT NOT NULL,
 status TEXT NOT NULL,
 severity TEXT,
 signature TEXT,
 latest_json TEXT NOT NULL,
 first_seen_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 valid_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_weather_alert_state_recent ON weather_alert_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_weather_alert_state_status ON weather_alert_state(status);

CREATE TABLE IF NOT EXISTS weather_alert_transitions (
 event_id TEXT PRIMARY KEY,
 alert_id TEXT NOT NULL,
 changed_at TEXT NOT NULL,
 previous_status TEXT,
 new_status TEXT NOT NULL,
 kind TEXT NOT NULL,
 payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weather_alert_history_time ON weather_alert_transitions(changed_at);

CREATE TABLE IF NOT EXISTS weather_station_observations (
 station_id TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 wind_kmh REAL,
 gust_kmh REAL,
 latitude REAL,
 longitude REAL,
 source_class TEXT NOT NULL,
 PRIMARY KEY(station_id, observed_at)
);
CREATE TABLE IF NOT EXISTS weather_rain_observations (
 station_id TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 period_start TEXT,
 accumulation_mm REAL,
 increment_mm REAL,
 PRIMARY KEY(station_id, observed_at)
);
