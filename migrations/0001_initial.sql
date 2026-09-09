CREATE TABLE purchases (
 id TEXT PRIMARY KEY, operation_id TEXT UNIQUE, purchased_at TEXT NOT NULL,
 gross_sats INTEGER NOT NULL CHECK(gross_sats > 0), fee_sats INTEGER NOT NULL CHECK(fee_sats >= 0 AND fee_sats < gross_sats),
 price TEXT NOT NULL, total_cents INTEGER NOT NULL, contribution_cents INTEGER NOT NULL CHECK(contribution_cents > 0),
 note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX purchases_date ON purchases(purchased_at);
CREATE TABLE quotes (
 id TEXT PRIMARY KEY, day TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('midday','close','manual')),
 price TEXT NOT NULL, captured_at TEXT NOT NULL, source_timestamp TEXT NOT NULL, raw_json TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'Bitpreço / last'
);
CREATE UNIQUE INDEX quotes_scheduled ON quotes(day, kind) WHERE kind != 'manual';
CREATE INDEX quotes_date ON quotes(captured_at);
CREATE TABLE collection_runs (id TEXT PRIMARY KEY, attempted_at TEXT NOT NULL, kind TEXT NOT NULL, success INTEGER NOT NULL, message TEXT NOT NULL);
CREATE TABLE contents (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, title TEXT NOT NULL, snapshot_json TEXT NOT NULL, channels_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE auth_attempts (ip_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);
