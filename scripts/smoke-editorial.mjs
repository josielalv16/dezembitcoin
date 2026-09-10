// LOCAL integration only: uses the local D1 instance and never calls production.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
let cookie = "";
const password = process.env.TEST_PASSWORD;
if (!password) throw new Error("Defina TEST_PASSWORD para o ambiente local.");
async function call(path, method = "GET", body) {
  const r = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, headers: r.headers, data: await r.json() };
}
async function ok(path, method = "GET", body) {
  const r = await call(path, method, body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
const login = await call("login", "POST", { password });
assert.equal(login.status, 200);
cookie = login.headers.get("set-cookie").split(";")[0];
const month = "2026-09";
await ok("editorial/calendar", "POST", { month, months: 12, monthlyDay: 1 });
let data = await ok("editorial/data?month=" + month);
const count = data.items.length;
await ok("editorial/calendar", "POST", { month, months: 12, monthlyDay: 1 });
assert.equal((await ok("editorial/data?month=" + month)).items.length, count);
const item = data.items.find(
  (i) => i.kind === "daily" && i.planned_date === "2026-09-09",
);
assert.ok(item);
const path = "editorial/items/" + encodeURIComponent(item.id);
let detail = await ok(path);
// Remove confirmations from earlier local test runs, preserving the audit trail.
for (const p of detail.publications) {
  await ok(path + "/undo", "POST", {
    revision: detail.item.revision,
    channel: p.channel,
  });
  detail = await ok(path);
}
const before = detail.versions.length;
const generated = await ok(path + "/generate", "POST", {
  revision: detail.item.revision,
});
detail = await ok(path);
assert.equal(detail.versions.length, before + 1);
const original = detail.versions.find(
  (v) => v.id === generated.versionId,
).snapshot_json;
const publish = {
  revision: detail.item.revision,
  versionId: generated.versionId,
  channels: ["instagram"],
  confirmed: true,
  published_at: new Date().toISOString(),
  url: "https://example.com/local-fixture",
  note: "LOCAL TEST",
};
assert.equal((await call(path + "/publish", "POST", publish)).status, 400);
await ok(path + "/review", "POST", {
  revision: detail.item.revision,
  versionId: generated.versionId,
  confirmed: true,
});
detail = await ok(path);
// Racing confirmations: only one transaction may succeed with the same revision.
const results = await Promise.all([
  call(path + "/publish", "POST", {
    ...publish,
    revision: detail.item.revision,
  }),
  call(path + "/publish", "POST", {
    ...publish,
    revision: detail.item.revision,
  }),
]);
assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
data = await ok("editorial/data?month=" + month);
assert.equal(
  data.items.find((i) => i.id === item.id).state,
  "publicado_parcialmente",
);
detail = await ok(path);
await ok(path + "/publish", "POST", {
  ...publish,
  revision: detail.item.revision,
  channels: ["threads", "youtube"],
  url: "",
});
assert.equal(
  (await ok("editorial/data?month=" + month)).items.find(
    (i) => i.id === item.id,
  ).state,
  "publicado",
);
detail = await ok(path);
await ok(path + "/undo", "POST", {
  revision: detail.item.revision,
  channel: "threads",
});
detail = await ok(path);
assert.ok(detail.history.some((v) => v.action === "desfazer_publicacao"));
await ok(path + "/generate", "POST", { revision: detail.item.revision });
detail = await ok(path);
assert.equal(
  detail.versions.find((v) => v.id === generated.versionId).snapshot_json,
  original,
);
assert.ok(
  detail.publications.every((p) => p.version_id === generated.versionId),
);
const radar = data.items.find((i) => i.kind === "radar");
const radarPath = "editorial/items/" + encodeURIComponent(radar.id);
const rd = await ok(radarPath);
assert.equal(
  (await call(radarPath + "/generate", "POST", { revision: rd.item.revision }))
    .status,
  400,
);
const badNews = {
  revision: rd.item.revision,
  news: [
    {
      url: "https://example.com/future",
      title: "Future",
      source: "fixture",
      published_at: "2027-01-01T12:00:00.000Z",
    },
  ],
};
assert.equal((await call(radarPath + "/news", "POST", badNews)).status, 400);
await ok("editorial/milestones", "POST", {
  metric: "contributions",
  target: 1,
  title: "LOCAL TEST aporte",
});
const events = (await ok("editorial/milestones")).events;
assert.ok(events.length > 0);
await ok("editorial/milestones/sync", "POST", {});
assert.equal((await ok("editorial/milestones")).events.length, events.length);
const mi = events[0];
const md = await ok("editorial/items/" + encodeURIComponent(mi.item_id));
const mg = await ok(
  "editorial/items/" + encodeURIComponent(mi.item_id) + "/generate",
  "POST",
  { revision: md.item.revision },
);
assert.ok(mg.snapshot.pages[1].body);
assert.ok(!mg.snapshot.pages[1].body.startsWith("{"));
const backup = await ok("backup");
assert.equal(backup.version, 2);
for (const name of [
  "calendar_items",
  "editorial_versions",
  "editorial_publications",
  "editorial_actions",
  "milestone_events",
  "editorial_news",
])
  assert.ok(Array.isArray(backup.editorial[name]));
console.log(
  "Editorial integration passed: 12-month idempotency, review gates, concurrent confirmations, partial/full/undo, immutable versions, radar validation, milestone persistence and backup.",
);
