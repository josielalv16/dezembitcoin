-- Add the second Buffer account without changing historical deliveries or plans.
CREATE TABLE buffer_channels_youtube (
 service TEXT PRIMARY KEY CHECK(service IN ('instagram','threads','tiktok','youtube')),
 channel_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO buffer_channels_youtube SELECT * FROM buffer_channels;
DROP TABLE buffer_channels;
ALTER TABLE buffer_channels_youtube RENAME TO buffer_channels;

DROP TRIGGER calendar_buffer_default;
CREATE TRIGGER calendar_buffer_default AFTER INSERT ON calendar_items
 WHEN NEW.channels_json='["instagram","threads","youtube"]'
 BEGIN UPDATE calendar_items SET channels_json='["instagram","threads","tiktok","youtube"]' WHERE id=NEW.id; END;
