import { parseRadarPackage, radarSnapshot } from "./radar-import";
import type { CalendarItem } from "./editorial-domain";
export async function importRadar(db: D1Database, value: unknown) {
  const p = parseRadarPackage(value),
    statements: D1PreparedStatement[] = [],
    keys: string[] = [];
  for (const story of p.stories) {
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(story.sources[0].url),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const key = `radar-import:${p.weekEnd}:${hash}`,
      id = crypto.randomUUID(),
      version = crypto.randomUUID(),
      at = new Date().toISOString();
    keys.push(key);
    const item: CalendarItem = {
      id,
      origin_key: key,
      planned_date: p.weekEnd,
      deadline: p.weekEnd,
      kind: "radar",
      title: story.title,
      period_start: p.weekStart,
      period_end: p.weekEnd,
      note: "",
      lifecycle: "active",
      cancel_reason: "",
      extra: 1,
      channels_json: '["instagram","threads","tiktok"]',
      current_version: version,
      revision: 1,
      created_at: at,
      updated_at: at,
    };
    const snapshot = radarSnapshot(p, story, item),
      n = snapshot.news[0];
    // Only the request that inserts this random item ID can insert its version/news.
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO calendar_items(id,origin_key,planned_date,deadline,kind,title,period_start,period_end,extra,channels_json,current_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?,?,?)",
        )
        .bind(
          id,
          key,
          p.weekEnd,
          p.weekEnd,
          "radar",
          story.title,
          p.weekStart,
          p.weekEnd,
          item.channels_json,
          version,
          at,
          at,
        ),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO editorial_versions SELECT ?,?,?,1,?,NULL WHERE EXISTS(SELECT 1 FROM calendar_items WHERE id=?)",
        )
        .bind(version, id, at, JSON.stringify(snapshot), id),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO editorial_news SELECT ?,?,?,?,?,?,?,?,?,?,?,1,0 WHERE EXISTS(SELECT 1 FROM calendar_items WHERE id=?)",
        )
        .bind(
          n.id,
          id,
          n.url,
          n.title,
          n.source,
          n.published_at,
          n.event_date,
          n.summary,
          n.context,
          n.impact,
          n.classification,
          id,
        ),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO editorial_actions(id,item_id,created_at,action,details_json) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM calendar_items WHERE id=?)",
        )
        .bind(
          crypto.randomUUID(),
          id,
          at,
          "importar_radar",
          JSON.stringify({
            researchedAt: p.researchedAt,
            sources: story.sources,
          }),
          id,
        ),
    );
  }
  const results = await db.batch(statements);
  const created = results
    .filter((_, i) => i % 4 === 0)
    .reduce((n, r) => n + r.meta.changes, 0);
  return {
    created,
    skipped: p.stories.length - created,
    weekEnd: p.weekEnd,
    keys,
  };
}
