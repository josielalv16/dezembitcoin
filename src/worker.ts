import Decimal from "decimal.js";
import { z } from "zod";
import {
  START,
  localDay,
  makeSnapshot,
  purchaseSchema,
  type Purchase,
  type Quote,
} from "./domain";
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
}
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const digest = async (s: string) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.reduce((n, v, i) => n | (v ^ b[i]), 0) === 0;
async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function authorized(request: Request, env: Env) {
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16) return false;
  const cookie = request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!cookie) return false;
  const [expires, nonce, sig] = cookie.split(".");
  if (
    !/^\d+$/.test(expires) ||
    !nonce ||
    !sig ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 86400001
  )
    return false;
  return equal(
    await digest(sig),
    await digest(await signature(`${expires}.${nonce}`, env.ADMIN_PASSWORD)),
  );
}
async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Envie JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Corpo vazio.");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64000) {
      await reader.cancel();
      throw new Error("Conteúdo muito grande.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
const rows = async (env: Env) => {
  const [p, q, c, r] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM purchases ORDER BY purchased_at",
    ).all<Purchase>(),
    env.DB.prepare("SELECT * FROM quotes ORDER BY captured_at").all<Quote>(),
    env.DB.prepare(
      "SELECT id,created_at,title,channels_json FROM contents ORDER BY created_at DESC",
    ).all(),
    env.DB.prepare(
      "SELECT * FROM collection_runs ORDER BY attempted_at DESC LIMIT 30",
    ).all(),
  ]);
  return {
    purchases: p.results,
    quotes: q.results,
    contents: c.results,
    runs: r.results,
    start: START,
  };
};
export async function capture(
  env: Env,
  kind: Quote["kind"],
  scheduledTime?: number,
) {
  const now = new Date().toISOString(),
    day = localDay(now),
    id = crypto.randomUUID();
  if (scheduledTime && localDay(new Date(scheduledTime).toISOString()) !== day)
    throw new Error("Execução fora do dia previsto.");
  if (
    kind !== "manual" &&
    (await env.DB.prepare("SELECT id FROM quotes WHERE day=? AND kind=?")
      .bind(day, kind)
      .first())
  )
    return null;
  try {
    const response = await fetch("https://api.bitpreco.com/btc-brl/ticker", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Provedor indisponível.");
    const raw = z
      .object({
        success: z.literal(true),
        market: z.literal("BTC-BRL"),
        last: z.number().positive().max(1e12),
        timestamp: z.string().min(1).max(100),
      })
      .passthrough()
      .parse(await response.json());
    const captured = new Date().toISOString();
    if (localDay(captured) !== day)
      throw new Error("Consulta atravessou a data de referência.");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO quotes(id,day,kind,price,captured_at,source_timestamp,raw_json) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        id,
        day,
        kind,
        String(raw.last),
        captured,
        raw.timestamp,
        JSON.stringify(raw),
      ),
      env.DB.prepare("INSERT INTO collection_runs VALUES(?,?,?,?,?)").bind(
        crypto.randomUUID(),
        captured,
        kind,
        1,
        "Cotação registrada.",
      ),
    ]);
    return await env.DB.prepare("SELECT * FROM quotes WHERE id=?")
      .bind(id)
      .first<Quote>();
  } catch (e) {
    await env.DB.prepare("INSERT INTO collection_runs VALUES(?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        now,
        kind,
        0,
        "Falha na consulta Bitpreço. Uma nova tentativa será feita na próxima janela programada.",
      )
      .run();
    throw new Error(
      "Não foi possível consultar a Bitpreço. Verifique o histórico de coletas.",
    );
  }
}
async function api(request: Request, env: Env) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (method !== "GET" && request.headers.get("Origin") !== url.origin)
    return json({ error: "Origem não autorizada." }, 403);
  if (path === "/api/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16)
      return json(
        {
          error:
            "Configure o segredo ADMIN_PASSWORD com pelo menos 16 caracteres no Cloudflare.",
        },
        503,
      );
    const ip = [
      ...(await digest(request.headers.get("CF-Connecting-IP") ?? "local")),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const now = Date.now();
    const attempt = await env.DB.prepare(
      `INSERT INTO auth_attempts VALUES(?,?,1) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END RETURNING attempts`,
    )
      .bind(ip, now, now - 900000, now - 900000)
      .first<{ attempts: number }>();
    if ((attempt?.attempts ?? 99) > 10)
      return json({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
    const { password } = z
      .object({ password: z.string().max(500) })
      .parse(await readBody(request));
    if (!equal(await digest(password), await digest(env.ADMIN_PASSWORD)))
      return json({ error: "Senha incorreta." }, 401);
    const value = `${now + 86400000}.${crypto.randomUUID()}`;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `session=${value}.${await signature(value, env.ADMIN_PASSWORD)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  }
  if (!(await authorized(request, env)))
    return json({ error: "Entre para acessar seu diário." }, 401);
  if (path === "/api/logout" && method === "POST")
    return new Response("{}", {
      headers: {
        "Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        "Cache-Control": "no-store",
      },
    });
  if (path === "/api/data" && method === "GET") return json(await rows(env));
  if (path === "/api/backup" && method === "GET") {
    const data = await rows(env);
    const contents = await env.DB.prepare(
      "SELECT * FROM contents ORDER BY created_at",
    ).all();
    const response = json({
      version: 1,
      exportedAt: new Date().toISOString(),
      ...data,
      contents: contents.results,
    });
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="dez-em-bitcoin-${localDay(new Date().toISOString())}.json"`,
    );
    return response;
  }
  if (path === "/api/quotes" && method === "POST") {
    const last = await env.DB.prepare(
      "SELECT captured_at FROM quotes WHERE kind='manual' ORDER BY captured_at DESC LIMIT 1",
    ).first<{ captured_at: string }>();
    if (last && Date.now() - Date.parse(last.captured_at) < 60000)
      return json({ error: "Aguarde um minuto entre consultas manuais." }, 429);
    return json(await capture(env, "manual"));
  }
  const purchaseMatch = path.match(/^\/api\/purchases(?:\/([\w-]+))?$/);
  if (purchaseMatch && ["POST", "PUT"].includes(method)) {
    const id = purchaseMatch[1] ?? crypto.randomUUID();
    if (
      method === "PUT" &&
      !(await env.DB.prepare("SELECT id FROM purchases WHERE id=?")
        .bind(id)
        .first())
    )
      return json({ error: "Compra não encontrada." }, 404);
    const p = purchaseSchema.parse(await readBody(request)),
      now = new Date().toISOString();
    const args = [
      p.operation_id || null,
      new Date(p.purchased_at).toISOString(),
      new Decimal(p.quantity).mul(1e8).toNumber(),
      new Decimal(p.fee).mul(1e8).toNumber(),
      p.price,
      new Decimal(p.total).mul(100).toNumber(),
      new Decimal(p.contribution).mul(100).toNumber(),
      p.note,
    ];
    try {
      if (method === "PUT")
        await env.DB.prepare(
          "UPDATE purchases SET operation_id=?,purchased_at=?,gross_sats=?,fee_sats=?,price=?,total_cents=?,contribution_cents=?,note=?,updated_at=? WHERE id=?",
        )
          .bind(...args, now, id)
          .run();
      else
        await env.DB.prepare(
          "INSERT INTO purchases(operation_id,purchased_at,gross_sats,fee_sats,price,total_cents,contribution_cents,note,created_at,updated_at,id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
          .bind(...args, now, now, id)
          .run();
    } catch {
      return json(
        {
          error:
            "Não foi possível salvar. Confira se o ID da operação já foi cadastrado.",
        },
        409,
      );
    }
    return json({ id });
  }
  if (purchaseMatch?.[1] && method === "DELETE") {
    await env.DB.prepare("DELETE FROM purchases WHERE id=?")
      .bind(purchaseMatch[1])
      .run();
    return json({ ok: true });
  }
  if (path === "/api/snapshot" && method === "POST") {
    const p = z
      .object({
        type: z.enum(["daily", "weekly", "monthly"]),
        start: z.iso.date(),
        end: z.iso.date(),
        quoteId: z.uuid(),
      })
      .parse(await readBody(request));
    if (
      p.start < START ||
      p.end < p.start ||
      p.end > localDay(new Date().toISOString()) ||
      Date.parse(p.end) - Date.parse(p.start) > 366 * 86400000
    )
      return json({ error: "Período inválido (máximo 366 dias)." }, 400);
    const data = await rows(env);
    return json(
      makeSnapshot(
        data.purchases,
        data.quotes,
        p.type,
        p.start,
        p.end,
        p.quoteId,
      ),
    );
  }
  if (path === "/api/contents" && method === "POST") {
    // Recalculate on server: clients cannot supply invented balances to the archive.
    const p = z
      .object({
        type: z.enum(["daily", "weekly", "monthly"]),
        start: z.iso.date(),
        end: z.iso.date(),
        quoteId: z.uuid(),
      })
      .parse(await readBody(request));
    if (
      p.start < START ||
      p.end < p.start ||
      p.end > localDay(new Date().toISOString()) ||
      Date.parse(p.end) - Date.parse(p.start) > 366 * 86400000
    )
      return json({ error: "Período inválido." }, 400);
    const data = await rows(env),
      snapshot = makeSnapshot(
        data.purchases,
        data.quotes,
        p.type,
        p.start,
        p.end,
        p.quoteId,
      ),
      id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO contents(id,created_at,title,snapshot_json) VALUES(?,?,?,?)",
    )
      .bind(
        id,
        new Date().toISOString(),
        `${snapshot.title} · ${p.end}`,
        JSON.stringify(snapshot),
      )
      .run();
    return json({ id, snapshot });
  }
  const contentMatch = path.match(/^\/api\/contents\/([\w-]+)$/);
  if (contentMatch && method === "GET") {
    const c = await env.DB.prepare("SELECT * FROM contents WHERE id=?")
      .bind(contentMatch[1])
      .first();
    return c ? json(c) : json({ error: "Conteúdo não encontrado." }, 404);
  }
  if (contentMatch && method === "PUT") {
    const p = z
      .object({
        instagram: z.boolean(),
        threads: z.boolean(),
        youtube: z.boolean(),
      })
      .parse(await readBody(request));
    await env.DB.prepare("UPDATE contents SET channels_json=? WHERE id=?")
      .bind(JSON.stringify(p), contentMatch[1])
      .run();
    return json({ ok: true });
  }
  return json({ error: "Rota não encontrada." }, 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith("/api/"))
        return await api(request, env);
      const result = await env.ASSETS.fetch(request);
      const response = new Response(result.body, result);
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "same-origin");
      return response;
    } catch (e) {
      if (e instanceof z.ZodError)
        return json({ error: e.issues.map((i) => i.message).join("; ") }, 400);
      if (
        e instanceof Error &&
        (e.message.startsWith("Escolha") ||
          e.message.startsWith("Não ") ||
          e.message.startsWith("Envie") ||
          e.message.startsWith("Conteúdo"))
      )
        return json({ error: e.message }, 400);
      console.error("Request failed", e instanceof Error ? e.name : "unknown");
      return json(
        {
          error:
            "Não foi possível concluir. Verifique a configuração do banco e tente novamente.",
        },
        500,
      );
    }
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      (async () => {
        const kind = controller.cron.includes("15") ? "midday" : "close";
        await capture(env, kind, controller.scheduledTime);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM auth_attempts WHERE window_start<?").bind(
            Date.now() - 86400000,
          ),
          env.DB.prepare(
            "DELETE FROM collection_runs WHERE attempted_at<?",
          ).bind(new Date(Date.now() - 90 * 86400000).toISOString()),
        ]);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
