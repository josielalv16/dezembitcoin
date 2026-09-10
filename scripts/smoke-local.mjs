// Integration checks against a running LOCAL Wrangler/D1 instance only.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
const password = process.env.TEST_PASSWORD;
if (!password)
  throw new Error("Defina TEST_PASSWORD com a senha do ambiente local.");
let cookie = "";
async function call(path, method = "GET", body, withAuth = true) {
  const r = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      ...(withAuth ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, headers: r.headers, data: await r.json() };
}
assert.equal((await call("data", "GET", undefined, false)).status, 401);
const login = await call("login", "POST", { password });
assert.equal(login.status, 200);
cookie = login.headers.get("set-cookie").split(";")[0];
const cross = await fetch(origin + "/api/quotes", {
  method: "POST",
  headers: {
    Origin: "https://example.com",
    Cookie: cookie,
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(cross.status, 403);
const id = crypto.randomUUID();
let purchaseId;
try {
  const input = {
    operation_id: "smoke-" + id,
    purchased_at: new Date(Date.now() - 120000).toISOString(),
    quantity: "0.00002479",
    fee: "0.00000012",
    price: "403296",
    total: "9.95",
    contribution: "10",
    note: "Local integration fixture",
  };
  const saved = await call("purchases", "POST", input);
  assert.equal(saved.status, 200);
  purchaseId = saved.data.id;
  assert.equal((await call("purchases", "POST", input)).status, 409);
  assert.equal(
    (
      await call("purchases", "POST", {
        ...input,
        operation_id: "bad-" + id,
        fee: "1",
      })
    ).status,
    400,
  );
  let data = (await call("data")).data;
  let quote = data.quotes
    .filter(
      (q) =>
        q.day ===
          new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10) &&
        q.captured_at >= input.purchased_at,
    )
    .at(-1);
  if (!quote) {
    const result = await call("quotes", "POST", {});
    assert.equal(result.status, 200);
    quote = result.data;
  }
  const request = {
    type: "daily",
    start: quote.day,
    end: quote.day,
    quoteId: quote.id,
  };
  const draft = await call("snapshot", "POST", request);
  assert.equal(draft.status, 200);
  assert.ok(draft.data.sats >= 2467);
  const archive = await call("contents", "POST", request);
  assert.equal(archive.status, 200);
  const frozen = JSON.stringify(archive.data.snapshot);
  assert.equal(
    (
      await call("purchases/" + purchaseId, "PUT", {
        ...input,
        contribution: "20",
      })
    ).status,
    200,
  );
  const after = await call("contents/" + archive.data.id);
  assert.equal(JSON.stringify(JSON.parse(after.data.snapshot_json)), frozen);
  const updated = await call("snapshot", "POST", request);
  assert.equal(
    Number(updated.data.contributed),
    Number(draft.data.contributed) + 10,
  );
  assert.equal(
    (
      await call("contents/" + archive.data.id, "PUT", {
        instagram: true,
        threads: false,
        youtube: false,
      })
    ).status,
    200,
  );
  const backup = await call("backup");
  assert.equal(backup.status, 200);
  assert.equal(backup.data.version, 2);
  assert.ok(backup.data.contents.some((c) => c.id === archive.data.id));
  assert.equal(
    (await call("snapshot", "POST", { ...request, end: "2020-01-01" })).status,
    400,
  );
  console.log(
    "PASS: auth, CSRF, purchase validation, duplicate prevention, quote, snapshot, immutable archive, status, backup.",
  );
  console.log("Local-only test archive ID:", archive.data.id);
} finally {
  if (purchaseId)
    assert.equal((await call("purchases/" + purchaseId, "DELETE")).status, 200);
}
