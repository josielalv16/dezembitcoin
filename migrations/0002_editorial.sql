CREATE TABLE editorial_settings (id INTEGER PRIMARY KEY CHECK(id=1), monthly_day INTEGER NOT NULL DEFAULT 1, horizon INTEGER NOT NULL DEFAULT 3);
INSERT INTO editorial_settings(id) VALUES(1);
CREATE TABLE calendar_items (
 id TEXT PRIMARY KEY, origin_key TEXT NOT NULL UNIQUE, planned_date TEXT NOT NULL, deadline TEXT NOT NULL,
 kind TEXT NOT NULL, title TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '', lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','paused','cancelled')),
 cancel_reason TEXT NOT NULL DEFAULT '', extra INTEGER NOT NULL DEFAULT 0, channels_json TEXT NOT NULL DEFAULT '["instagram","threads","youtube"]',
 current_version TEXT, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX calendar_date ON calendar_items(planned_date);
CREATE TABLE editorial_versions (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES calendar_items(id), created_at TEXT NOT NULL,
 template_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, reviewed_at TEXT
);
CREATE INDEX editorial_version_item ON editorial_versions(item_id,created_at);
CREATE TABLE editorial_publications (
 item_id TEXT NOT NULL REFERENCES calendar_items(id), channel TEXT NOT NULL CHECK(channel IN ('instagram','threads','youtube')),
 version_id TEXT REFERENCES editorial_versions(id), published_at TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT 'proprietario',
 PRIMARY KEY(item_id,channel)
);
CREATE TABLE editorial_actions (id TEXT PRIMARY KEY,item_id TEXT,created_at TEXT NOT NULL,action TEXT NOT NULL,details_json TEXT NOT NULL,actor TEXT NOT NULL DEFAULT 'proprietario');
CREATE INDEX editorial_actions_item ON editorial_actions(item_id,created_at);
CREATE TABLE milestone_definitions(id TEXT PRIMARY KEY,metric TEXT NOT NULL,target TEXT NOT NULL,title TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1, UNIQUE(metric,target));
CREATE TABLE milestone_events(id TEXT PRIMARY KEY,definition_id TEXT NOT NULL REFERENCES milestone_definitions(id),event_key TEXT NOT NULL UNIQUE,achieved_at TEXT NOT NULL,value TEXT NOT NULL,snapshot_json TEXT NOT NULL,item_id TEXT NOT NULL REFERENCES calendar_items(id));
CREATE TABLE editorial_news(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES calendar_items(id),url TEXT NOT NULL,title TEXT NOT NULL,source TEXT NOT NULL,published_at TEXT NOT NULL,event_date TEXT NOT NULL DEFAULT '',summary TEXT NOT NULL DEFAULT '',context TEXT NOT NULL DEFAULT '',impact TEXT NOT NULL DEFAULT '',classification TEXT NOT NULL DEFAULT 'noticia',selected INTEGER NOT NULL DEFAULT 0,reviewed INTEGER NOT NULL DEFAULT 0, UNIQUE(item_id,url));
CREATE TABLE editorial_jobs(id TEXT PRIMARY KEY,executed_at TEXT NOT NULL,job TEXT NOT NULL,success INTEGER NOT NULL,message TEXT NOT NULL);
CREATE TABLE editorial_revision_guard(item_id TEXT PRIMARY KEY,expected INTEGER NOT NULL,actual INTEGER NOT NULL,CHECK(expected=actual));
