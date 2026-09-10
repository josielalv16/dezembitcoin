CREATE TABLE buffer_assets (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES editorial_versions(id),
 mime TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX buffer_assets_version ON buffer_assets(version_id);
CREATE TABLE buffer_channels (
 service TEXT PRIMARY KEY CHECK(service IN ('instagram','threads','tiktok')),
 channel_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE buffer_deliveries (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES calendar_items(id),
 version_id TEXT NOT NULL REFERENCES editorial_versions(id), service TEXT NOT NULL,
 channel_id TEXT NOT NULL, payload_json TEXT NOT NULL, assets_json TEXT NOT NULL,
 status TEXT NOT NULL, post_id TEXT, due_at TEXT, sent_at TEXT, url TEXT NOT NULL DEFAULT '',
 error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 checked_at TEXT, next_check_at TEXT NOT NULL
);
CREATE UNIQUE INDEX buffer_one_delivery ON buffer_deliveries(item_id,service) WHERE status NOT IN ('rejected','cancelled');
CREATE INDEX buffer_poll ON buffer_deliveries(status,next_check_at);

-- Preserve historical YouTube confirmations, adding TikTok support.
CREATE TABLE editorial_publications_new (
 item_id TEXT NOT NULL REFERENCES calendar_items(id), channel TEXT NOT NULL CHECK(channel IN ('instagram','threads','youtube','tiktok')),
 version_id TEXT REFERENCES editorial_versions(id), published_at TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT 'proprietario',
 PRIMARY KEY(item_id,channel)
);
INSERT INTO editorial_publications_new SELECT * FROM editorial_publications;
DROP TABLE editorial_publications;
ALTER TABLE editorial_publications_new RENAME TO editorial_publications;
UPDATE calendar_items SET channels_json=replace(channels_json,'"youtube"','"tiktok"')
 WHERE NOT EXISTS(SELECT 1 FROM editorial_publications p WHERE p.item_id=calendar_items.id AND p.channel='youtube');
CREATE TRIGGER calendar_buffer_default AFTER INSERT ON calendar_items
 WHEN NEW.channels_json='["instagram","threads","youtube"]'
 BEGIN UPDATE calendar_items SET channels_json='["instagram","threads","tiktok"]' WHERE id=NEW.id; END;
CREATE TRIGGER buffer_protect_version BEFORE UPDATE ON calendar_items
 WHEN (NEW.current_version IS NOT OLD.current_version OR NEW.lifecycle<>OLD.lifecycle OR NEW.note<>OLD.note OR NEW.title<>OLD.title OR NEW.channels_json<>OLD.channels_json OR NEW.planned_date<>OLD.planned_date)
 AND EXISTS(SELECT 1 FROM buffer_deliveries d WHERE d.item_id=OLD.id AND d.status NOT IN ('sent','cancelled','rejected'))
 BEGIN SELECT RAISE(ABORT,'Conteudo com envio ativo no Buffer'); END;
CREATE TRIGGER buffer_protect_manual_publication BEFORE INSERT ON editorial_publications
 WHEN NEW.actor<>'buffer' AND EXISTS(SELECT 1 FROM buffer_deliveries d WHERE d.item_id=NEW.item_id AND d.service=NEW.channel AND d.status NOT IN ('rejected','cancelled'))
 BEGIN SELECT RAISE(ABORT,'Consulte a publicacao pelo Buffer'); END;
