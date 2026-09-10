import { z } from "zod";
import { localDay, addDays, type Purchase, type Quote } from "./domain";
import {
  CHANNELS,
  LABELS,
  planMonth,
  monthShift,
  readiness,
  itemState,
  buildEditorial,
  normalizeUrl,
  type CalendarItem,
  type Publication,
  type News,
  type EditorialSnapshot,
} from "./editorial-domain";
import {
  METRICS,
  defaultDefinitions,
  evaluateMilestones,
  type Definition,
  type Achievement,
} from "./editorial-milestones";
import { collectNews } from "./editorial-news";
type Env = { DB: D1Database };
const tables = [
  "editorial_settings",
  "calendar_items",
  "editorial_versions",
  "editorial_publications",
  "editorial_actions",
  "milestone_definitions",
  "milestone_events",
  "editorial_news",
  "editorial_jobs",
  "buffer_assets",
  "buffer_channels",
  "buffer_deliveries",
] as const;
const now = () => new Date().toISOString();
const today = () => localDay(now());
const uuid = () => crypto.randomUUID();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
  );
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const response = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
async function all<T>(env: Env, sql: string, ...args: (string | number)[]) {
  return (
    await env.DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function editorialBackup(env: Env) {
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        await all(env, `SELECT * FROM ${table}`),
      ]),
    ),
  );
}
function audit(env: Env, id: string | null, action: string, details: unknown) {
  return env.DB.prepare(
    "INSERT INTO editorial_actions(id,item_id,created_at,action,details_json) VALUES(?,?,?,?,?)",
  ).bind(uuid(), id, now(), action, JSON.stringify(details));
}
export async function generateCalendar(
  env: Env,
  start: string,
  count: number,
  monthlyDay: number,
) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    const planned = planMonth(monthShift(start, i), monthlyDay).map((p) => ({
      ...p,
      id: uuid(),
      at: now(),
    }));
    await env.DB.prepare(
      `INSERT OR IGNORE INTO calendar_items(id,origin_key,planned_date,deadline,kind,title,period_start,period_end,created_at,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.key'),json_extract(value,'$.date'),json_extract(value,'$.date'),json_extract(value,'$.kind'),json_extract(value,'$.title'),json_extract(value,'$.start'),json_extract(value,'$.end'),json_extract(value,'$.at'),json_extract(value,'$.at') FROM json_each(?)`,
    )
      .bind(JSON.stringify(planned))
      .run();
    total += planned.length;
  }
  return total;
}
async function financialData(env: Env) {
  const [purchases, quotes] = await Promise.all([
    all<Purchase>(env, "SELECT * FROM purchases ORDER BY purchased_at"),
    all<Quote>(env, "SELECT * FROM quotes ORDER BY captured_at"),
  ]);
  return { purchases, quotes };
}
export async function syncMilestones(env: Env) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO milestone_definitions SELECT json_extract(value,'$.id'),json_extract(value,'$.metric'),json_extract(value,'$.target'),json_extract(value,'$.title'),1 FROM json_each(?)`,
  )
    .bind(JSON.stringify(defaultDefinitions()))
    .run();
  const definitions = await all<Definition>(
      env,
      "SELECT * FROM milestone_definitions",
    ),
    data = await financialData(env);
  const reached = evaluateMilestones(
    definitions,
    data.purchases,
    data.quotes,
    today(),
  );
  const entries = reached.map((event) => ({
    id: uuid(),
    item: "milestone:" + event.key,
    title: definitions.find((d) => d.id === event.definitionId)!.title,
    day: localDay(event.achievedAt),
    today: today(),
    at: now(),
    event,
    snapshot: JSON.stringify(event),
  }));
  const result = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO calendar_items(id,origin_key,planned_date,deadline,kind,title,period_start,period_end,extra,created_at,updated_at) SELECT json_extract(value,'$.item'),json_extract(value,'$.item'),json_extract(value,'$.today'),json_extract(value,'$.today'),'milestone',json_extract(value,'$.title'),json_extract(value,'$.day'),json_extract(value,'$.day'),1,json_extract(value,'$.at'),json_extract(value,'$.at') FROM json_each(?)`,
    ).bind(JSON.stringify(entries)),
    env.DB.prepare(
      `INSERT OR IGNORE INTO milestone_events SELECT json_extract(value,'$.id'),json_extract(value,'$.event.definitionId'),json_extract(value,'$.event.key'),json_extract(value,'$.event.achievedAt'),json_extract(value,'$.event.value'),json_extract(value,'$.snapshot'),json_extract(value,'$.item') FROM json_each(?)`,
    ).bind(JSON.stringify(entries)),
  ]);
  const created = result[1].meta.changes;
  return { created, definitions, reached };
}
export async function editorialMaintenance(env: Env) {
  try {
    const settings = await env.DB.prepare(
      "SELECT * FROM editorial_settings WHERE id=1",
    ).first<{ monthly_day: number; horizon: number }>();
    await generateCalendar(
      env,
      today().slice(0, 7),
      settings?.horizon ?? 3,
      settings?.monthly_day ?? 1,
    );
    const result = await syncMilestones(env);
    await env.DB.prepare("INSERT INTO editorial_jobs VALUES(?,?,?,?,?)")
      .bind(
        uuid(),
        now(),
        "manutenção",
        1,
        `Calendário atualizado. ${result.created} novos marcos.`,
      )
      .run();
  } catch (e) {
    await env.DB.prepare("INSERT INTO editorial_jobs VALUES(?,?,?,?,?)")
      .bind(
        uuid(),
        now(),
        "manutenção",
        0,
        "Falha ao atualizar calendário/marcos. Tente novamente no painel.",
      )
      .run();
    throw e;
  }
  if (new Date(today() + "T12:00:00Z").getUTCDay() === 5) {
    const item = await env.DB.prepare(
      "SELECT * FROM calendar_items WHERE origin_key=? AND lifecycle='active'",
    )
      .bind("weekly:" + today())
      .first<CalendarItem>();
    if (item && !item.current_version) await collectNews(env, item);
  }
}
const newsSchema = z.object({
  url: z
    .string()
    .max(2000)
    .refine((value) => {
      try {
        normalizeUrl(value);
        return true;
      } catch {
        return false;
      }
    }, "URL inválida.")
    .transform(normalizeUrl),
  title: z.string().min(1).max(240),
  source: z.string().min(1).max(150),
  published_at: z.string().datetime({ offset: true }),
  event_date: z.union([date, z.literal("")]).default(""),
  summary: z.string().max(800).default(""),
  context: z.string().max(800).default(""),
  impact: z.string().max(800).default(""),
  classification: z.enum(["analise", "inferencia"]).default("analise"),
  selected: z.boolean().default(false),
  reviewed: z.boolean().default(false),
});
export async function editorialApi(
  request: Request,
  env: Env,
  readBody: (r: Request) => Promise<unknown>,
): Promise<Response> {
  try {
    return await route(request, env, readBody);
  } catch (e) {
    if (e instanceof z.ZodError)
      return response(
        { error: e.issues.map((v) => v.message).join("; ") },
        400,
      );
    if (e instanceof EditorialError)
      return response({ error: e.message }, e.status);
    throw e;
  }
}
class EditorialError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function route(
  request: Request,
  env: Env,
  readBody: (r: Request) => Promise<unknown>,
) {
  const url = new URL(request.url),
    path = url.pathname.replace("/api/editorial", ""),
    method = request.method;
  if (path === "/calendar" && method === "POST") {
    const p = z
      .object({
        month,
        months: z.union([
          z.literal(1),
          z.literal(3),
          z.literal(6),
          z.literal(12),
        ]),
        monthlyDay: z.number().int().min(1).max(28),
      })
      .parse(await readBody(request));
    await generateCalendar(env, p.month, p.months, p.monthlyDay);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE editorial_settings SET monthly_day=?,horizon=? WHERE id=1",
      ).bind(p.monthlyDay, p.months),
      audit(env, null, "gerar_calendario", p),
    ]);
    await syncMilestones(env);
    return response({ ok: true });
  }
  if (path === "/data" && method === "GET") {
    const requested = month.parse(
      url.searchParams.get("month") ?? today().slice(0, 7),
    );
    const [items, publications, versions, news, settings, jobs, deliveries] =
      await Promise.all([
        url.searchParams.get("scope") === "archive"
          ? all<CalendarItem>(
              env,
              "SELECT * FROM calendar_items WHERE EXISTS (SELECT 1 FROM editorial_versions v WHERE v.item_id=calendar_items.id) OR EXISTS (SELECT 1 FROM editorial_publications p WHERE p.item_id=calendar_items.id) ORDER BY planned_date DESC,created_at DESC",
            )
          : all<CalendarItem>(
              env,
              url.searchParams.get("scope") === "late"
                ? "SELECT * FROM calendar_items WHERE deadline>=? AND deadline<? ORDER BY deadline,planned_date"
                : "SELECT * FROM calendar_items WHERE planned_date>=? AND planned_date<? ORDER BY planned_date,extra,kind",
              url.searchParams.get("scope") === "late"
                ? "2026-09-09"
                : ["today", "week"].includes(
                      url.searchParams.get("scope") ?? "",
                    )
                  ? today()
                  : requested + "-01",
              url.searchParams.get("scope") === "late"
                ? today()
                : url.searchParams.get("scope") === "today"
                  ? addDays(today(), 1)
                  : url.searchParams.get("scope") === "week"
                    ? addDays(today(), 7)
                    : monthShift(requested, 1) + "-01",
            ),
        all<Publication>(env, "SELECT * FROM editorial_publications"),
        all<{ id: string; reviewed_at: string | null }>(
          env,
          "SELECT id,reviewed_at FROM editorial_versions",
        ),
        all<News>(env, "SELECT * FROM editorial_news"),
        env.DB.prepare("SELECT * FROM editorial_settings WHERE id=1").first(),
        all(
          env,
          "SELECT * FROM editorial_jobs ORDER BY executed_at DESC LIMIT 10",
        ),
        all(
          env,
          "SELECT id,item_id,service,status,due_at,post_id,url FROM buffer_deliveries WHERE status NOT IN ('rejected','cancelled')",
        ),
      ]);
    const data = await financialData(env);
    return response({
      items: items.map((item) => {
        const pending = readiness(
          item,
          data.purchases,
          data.quotes,
          news,
          today(),
        );
        return {
          ...item,
          pending,
          state: itemState(
            item,
            publications,
            !!versions.find((v) => v.id === item.current_version)?.reviewed_at,
            pending,
          ),
        };
      }),
      publications,
      deliveries,
      settings,
      jobs,
    });
  }
  if (path === "/milestones" && method === "GET") {
    const definitions = await all<Definition>(
        env,
        "SELECT * FROM milestone_definitions",
      ),
      events = await all(
        env,
        "SELECT * FROM milestone_events ORDER BY achieved_at DESC",
      ),
      data = await financialData(env),
      evaluated = evaluateMilestones(
        definitions,
        data.purchases,
        data.quotes,
        today(),
      );
    return response({
      definitions,
      events,
      evaluated,
      purchases: data.purchases,
      quote: data.quotes.at(-1) ?? null,
    });
  }
  if (path === "/milestones/sync" && method === "POST")
    return response(await syncMilestones(env));
  if (path === "/milestones" && method === "POST") {
    const p = z
      .object({
        metric: z
          .enum(METRICS)
          .refine((v) =>
            [
              "calendar_days",
              "purchase_days",
              "streak",
              "contributions",
              "sats",
              "wallet",
            ].includes(v),
          ),
        target: z.coerce.number().positive().max(1e12),
        title: z.string().min(1).max(140),
      })
      .parse(await readBody(request));
    if (
      ["calendar_days", "purchase_days", "streak", "sats"].includes(p.metric) &&
      (!Number.isInteger(p.target) || (p.metric !== "sats" && p.target > 36500))
    )
      throw new EditorialError("Informe um alvo inteiro válido.");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO milestone_definitions VALUES(?,?,?,?,1)",
      ).bind(uuid(), p.metric, String(p.target), p.title),
      audit(env, null, "definir_marco", p),
    ]);
    return response(await syncMilestones(env));
  }
  const match = path.match(
    /^\/items\/([^/]+)(?:\/(generate|review|publish|undo|news|draft|collect))?$/,
  );
  if (!match) return response({ error: "Rota editorial não encontrada." }, 404);
  const id = decodeURIComponent(match[1]),
    action = match[2];
  const item = await env.DB.prepare("SELECT * FROM calendar_items WHERE id=?")
    .bind(id)
    .first<CalendarItem>();
  if (!item) throw new EditorialError("Item não encontrado.", 404);
  if (method === "GET" && !action) {
    const [versions, publications, news, history, event] = await Promise.all([
      all(
        env,
        "SELECT * FROM editorial_versions WHERE item_id=? ORDER BY created_at DESC",
        id,
      ),
      all(env, "SELECT * FROM editorial_publications WHERE item_id=?", id),
      all(
        env,
        "SELECT * FROM editorial_news WHERE item_id=? ORDER BY published_at DESC",
        id,
      ),
      all(
        env,
        "SELECT * FROM editorial_actions WHERE item_id=? ORDER BY created_at DESC",
        id,
      ),
      env.DB.prepare("SELECT * FROM milestone_events WHERE item_id=?")
        .bind(id)
        .first(),
    ]);
    return response({ item, versions, publications, news, history, event });
  }
  const body = await readBody(request);
  const pendingBuffer = await env.DB.prepare(
    "SELECT id FROM buffer_deliveries WHERE item_id=? AND status NOT IN ('sent','cancelled','rejected') LIMIT 1",
  )
    .bind(id)
    .first();
  if (
    pendingBuffer &&
    (method === "PUT" ||
      ["generate", "draft", "news", "collect"].includes(action))
  )
    throw new EditorialError(
      "Este conteúdo tem envio ativo no Buffer. Resolva ou cancele no Buffer antes de alterar os materiais.",
      409,
    );
  const { revision } = z.object({ revision: z.number().int() }).parse(body);
  if (revision !== item.revision)
    throw new EditorialError(
      "Este item foi alterado em outra aba. Reabra para atualizar.",
      409,
    );
  // Every mutation starts with a revision assertion inside the same D1 transaction.
  // The CHECK aborts the entire batch on a concurrent edit.
  const guard = env.DB.prepare(
    "INSERT INTO editorial_revision_guard(item_id,expected,actual) SELECT id,?,revision FROM calendar_items WHERE id=?",
  ).bind(revision, id);
  const finish = env.DB.prepare(
    "UPDATE calendar_items SET revision=revision+1,updated_at=? WHERE id=?",
  ).bind(now(), id);
  const execute = async (statements: D1PreparedStatement[]) => {
    try {
      await env.DB.batch([
        guard,
        ...statements,
        finish,
        env.DB.prepare(
          "DELETE FROM editorial_revision_guard WHERE item_id=?",
        ).bind(id),
      ]);
    } catch (e) {
      if (String(e).includes("CHECK constraint"))
        throw new EditorialError(
          "Este item mudou. Reabra antes de salvar.",
          409,
        );
      throw e;
    }
  };
  if (method === "PUT" && !action) {
    const p = z
      .object({
        planned_date: date,
        deadline: date,
        title: z.string().min(1).max(180),
        note: z.string().max(2400),
        lifecycle: z.enum(["active", "paused", "cancelled"]),
        cancel_reason: z.string().max(600),
        extra: z.boolean(),
        channels: z
          .array(z.enum(CHANNELS))
          .min(1)
          .max(4)
          .refine((v) => new Set(v).size === v.length),
      })
      .parse(body);
    if (p.lifecycle === "cancelled" && !p.cancel_reason.trim())
      throw new EditorialError("Informe o motivo do cancelamento.");
    const currentPublications = await all<Publication>(
      env,
      "SELECT * FROM editorial_publications WHERE item_id=?",
      id,
    );
    if (
      currentPublications.some(
        (v) => !p.channels.includes(v.channel as (typeof CHANNELS)[number]),
      )
    )
      throw new EditorialError(
        "Desfaça a confirmação antes de remover uma rede publicada.",
      );
    const changedText = p.note !== item.note || p.title !== item.title;
    await execute([
      env.DB.prepare(
        "UPDATE calendar_items SET planned_date=?,deadline=?,title=?,note=?,lifecycle=?,cancel_reason=?,extra=?,channels_json=?,current_version=? WHERE id=?",
      ).bind(
        p.planned_date,
        p.deadline,
        p.title,
        p.note,
        p.lifecycle,
        p.cancel_reason,
        Number(p.extra),
        JSON.stringify(p.channels),
        changedText ? null : item.current_version,
        id,
      ),
      audit(env, id, "editar_item", { before: item, after: p }),
    ]);
    return response({ ok: true });
  }
  if (item.lifecycle !== "active" && action !== "undo")
    throw new EditorialError("Reative o item antes de continuar.");
  if (method === "POST" && action === "collect") {
    if (item.kind !== "radar") throw new EditorialError("Escolha um Radar.");
    const recent = await env.DB.prepare(
      "SELECT id FROM editorial_jobs WHERE job='radar' AND executed_at>?",
    )
      .bind(new Date(Date.now() - 60000).toISOString())
      .first();
    if (recent) throw new EditorialError("Aguarde um minuto entre coletas.");
    return response(await collectNews(env, item));
  }
  if (method === "POST" && action === "news") {
    if (item.kind !== "radar")
      throw new EditorialError("Notícias pertencem ao Radar.");
    const p = z.object({ news: z.array(newsSchema).max(20) }).parse(body);
    if (p.news.filter((n) => n.selected).length > 5)
      throw new EditorialError("Selecione no máximo cinco notícias.");
    if (new Set(p.news.map((n) => n.url)).size !== p.news.length)
      throw new EditorialError("Há URLs duplicadas.");
    if (
      p.news.some(
        (n) =>
          localDay(n.published_at) < item.period_start ||
          localDay(n.published_at) > item.period_end ||
          Date.parse(n.published_at) > Date.now(),
      )
    )
      throw new EditorialError(
        "A data de publicação deve estar no período do Radar e não pode ser futura.",
      );
    await execute([
      env.DB.prepare("DELETE FROM editorial_news WHERE item_id=?").bind(id),
      ...p.news.map((n) =>
        env.DB.prepare(
          "INSERT INTO editorial_news VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          uuid(),
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
          Number(n.selected),
          Number(n.reviewed),
        ),
      ),
      env.DB.prepare(
        "UPDATE calendar_items SET current_version=NULL WHERE id=?",
      ).bind(id),
      audit(env, id, "salvar_noticias", p),
    ]);
    return response({ ok: true });
  }
  if (method === "POST" && (action === "generate" || action === "draft")) {
    let snapshot: EditorialSnapshot;
    if (action === "generate") {
      const data = await financialData(env),
        news = await all<News>(
          env,
          "SELECT * FROM editorial_news WHERE item_id=?",
          id,
        ),
        event = await env.DB.prepare(
          "SELECT snapshot_json FROM milestone_events WHERE item_id=?",
        )
          .bind(id)
          .first<{ snapshot_json: string }>();
      try {
        snapshot = buildEditorial(
          item,
          data.purchases,
          data.quotes,
          news,
          today(),
          event ? JSON.parse(event.snapshot_json) : undefined,
        );
      } catch (e) {
        throw new EditorialError((e as Error).message);
      }
    } else {
      if (item.kind === "daily")
        throw new EditorialError(
          "A arte diária usa o modelo financeiro fixo. Corrija a compra e gere uma nova versão.",
        );
      const p = z
        .object({
          pages: z
            .array(
              z.object({
                title: z.string().min(1).max(180),
                body: z.string().max(2400),
                label: z.string().max(100),
                source: z.string().max(2400).optional(),
              }),
            )
            .min(1)
            .max(15),
        })
        .parse(body);
      const version = await env.DB.prepare(
        "SELECT snapshot_json FROM editorial_versions WHERE id=? AND item_id=?",
      )
        .bind(item.current_version, id)
        .first<{ snapshot_json: string }>();
      if (!version)
        throw new EditorialError("Gere uma versão antes de editar as páginas.");
      snapshot = JSON.parse(version.snapshot_json);
      snapshot.pages = p.pages.map((page, index) => ({
        ...page,
        chart: snapshot.pages[index]?.chart,
        chartMode: snapshot.pages[index]?.chartMode,
      }));
      snapshot.generatedAt = now();
      snapshot.prompt = JSON.stringify({
        instruction:
          "Preserve números, fontes e ordem. Arte preta, laranja e branca, sem pessoas.",
        pages: snapshot.pages,
      });
    }
    const versionId = uuid();
    await execute([
      env.DB.prepare(
        "INSERT INTO editorial_versions VALUES(?,?,?,?,?,NULL)",
      ).bind(versionId, id, now(), 1, JSON.stringify(snapshot)),
      env.DB.prepare(
        "UPDATE calendar_items SET current_version=? WHERE id=?",
      ).bind(versionId, id),
      audit(
        env,
        id,
        action === "generate" ? "gerar_versao" : "editar_paginas",
        { versionId },
      ),
    ]);
    return response({ versionId, snapshot });
  }
  if (method === "POST" && action === "review") {
    const p = z
      .object({ versionId: z.string(), confirmed: z.literal(true) })
      .parse(body);
    if (item.current_version !== p.versionId)
      throw new EditorialError("Revise a versão atual.");
    await execute([
      env.DB.prepare(
        "UPDATE editorial_versions SET reviewed_at=? WHERE id=? AND item_id=?",
      ).bind(now(), p.versionId, id),
      audit(env, id, "revisar", p),
    ]);
    return response({ ok: true });
  }
  if (method === "POST" && action === "publish") {
    const p = z
      .object({
        versionId: z.string(),
        channels: z.array(z.enum(CHANNELS)).min(1).max(4),
        published_at: z.string().datetime({ offset: true }),
        url: z.string().max(2000).default(""),
        note: z.string().max(600).default(""),
        confirmed: z.literal(true),
      })
      .parse(body);
    if (
      new Set(p.channels).size !== p.channels.length ||
      p.channels.some((c) => !JSON.parse(item.channels_json).includes(c))
    )
      throw new EditorialError("Selecione os canais deste item.");
    if (Date.parse(p.published_at) > Date.now())
      throw new EditorialError("A confirmação não pode ter data futura.");
    if (p.url) {
      try {
        p.url = normalizeUrl(p.url);
      } catch {
        throw new EditorialError("URL inválida.");
      }
      if (p.channels.length > 1)
        throw new EditorialError("Registre a URL individualmente por rede.");
    }
    const version = await env.DB.prepare(
      "SELECT reviewed_at FROM editorial_versions WHERE id=? AND item_id=?",
    )
      .bind(p.versionId, id)
      .first<{ reviewed_at: string | null }>();
    if (!version?.reviewed_at || p.versionId !== item.current_version)
      throw new EditorialError(
        "Gere e revise a versão atual antes de confirmar.",
      );
    const previous = await all<Publication>(
      env,
      "SELECT * FROM editorial_publications WHERE item_id=?",
      id,
    );
    if (
      previous.some((v) =>
        p.channels.includes(v.channel as (typeof CHANNELS)[number]),
      )
    )
      throw new EditorialError(
        "Canal já confirmado. Desfaça antes de registrar novamente.",
      );
    await execute([
      ...p.channels.map((c) =>
        env.DB.prepare(
          "INSERT INTO editorial_publications(item_id,channel,version_id,published_at,url,note) VALUES(?,?,?,?,?,?)",
        ).bind(id, c, p.versionId, p.published_at, p.url, p.note),
      ),
      audit(env, id, "confirmar_publicacao", p),
    ]);
    return response({ ok: true });
  }
  if (method === "POST" && action === "undo") {
    const p = z.object({ channel: z.enum(CHANNELS) }).parse(body),
      previous = await env.DB.prepare(
        "SELECT * FROM editorial_publications WHERE item_id=? AND channel=?",
      )
        .bind(id, p.channel)
        .first();
    if (!previous) throw new EditorialError("Essa rede não está confirmada.");
    await execute([
      env.DB.prepare(
        "DELETE FROM editorial_publications WHERE item_id=? AND channel=?",
      ).bind(id, p.channel),
      audit(env, id, "desfazer_publicacao", previous),
    ]);
    return response({ ok: true });
  }
  return response({ error: "Ação não encontrada." }, 404);
}
