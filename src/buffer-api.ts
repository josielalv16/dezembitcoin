import { z } from "zod";
import {
  BUFFER_SERVICES,
  sendSchema,
  validateSend,
  postInput,
  remoteStatus,
  type Delivery,
} from "./buffer-domain";
export type BufferEnv = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  BUFFER_API_KEY?: string;
};
const now = () => new Date().toISOString();
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const postFields = "id channelId status dueAt sentAt externalLink text";
type RemotePost = {
  id: string;
  channelId: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  externalLink: string | null;
  text: string;
};
type Channel = {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
};
class RemoteError extends Error {
  constructor(
    message: string,
    public definite = false,
  ) {
    super(message);
  }
}
export async function bufferGraph(
  env: BufferEnv,
  query: string,
  variables: unknown = {},
): Promise<any> {
  if (!env.BUFFER_API_KEY)
    throw new RemoteError(
      "Configure BUFFER_API_KEY nos segredos do Worker.",
      true,
    );
  let response: Response;
  try {
    response = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.BUFFER_API_KEY}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new RemoteError(
      "Sem confirmação do Buffer. Confira o painel antes de tentar novamente.",
    );
  }
  if (!response.ok)
    throw new RemoteError(
      `Buffer respondeu HTTP ${response.status}. Confira a conexão e os limites do plano.`,
      [400, 401, 403, 429].includes(response.status),
    );
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new RemoteError(
      "Resposta inválida do Buffer; confira se o post foi criado.",
    );
  }
  if (result.errors?.length || !result.data)
    throw new RemoteError(
      "A API do Buffer não confirmou a operação. Confira as permissões e o painel do Buffer.",
    );
  return result.data;
}
async function channels(
  env: BufferEnv,
  organizationId: string,
): Promise<Channel[]> {
  const data = await bufferGraph(
    env,
    `query Channels($input: ChannelsInput!) { channels(input:$input) { id name displayName service isDisconnected isLocked isQueuePaused } }`,
    { input: { organizationId } },
  );
  return data.channels;
}
async function version(env: BufferEnv, id: string) {
  const result = await env.DB.prepare(
    "SELECT v.id,v.item_id,v.reviewed_at,i.current_version,i.lifecycle,i.channels_json FROM editorial_versions v JOIN calendar_items i ON i.id=v.item_id WHERE v.id=?",
  )
    .bind(id)
    .first<{
      id: string;
      item_id: string;
      reviewed_at: string | null;
      current_version: string | null;
      lifecycle: string;
      channels_json: string;
    }>();
  if (!result || result.current_version !== id || result.lifecycle !== "active")
    throw new Error(
      "Gere a versão atual de um conteúdo ativo antes de enviar.",
    );
  return result;
}
function safeLink(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
async function recordPost(
  env: BufferEnv,
  delivery: Delivery,
  post: RemotePost,
) {
  if (post.channelId !== delivery.channel_id)
    throw new Error("O post retornado pertence a outro canal.");
  const status =
    post.status === "sent" &&
    (!post.sentAt || !Number.isFinite(Date.parse(post.sentAt)))
      ? "processing"
      : remoteStatus(post.status);
  const at = now();
  const due =
    post.dueAt && Number.isFinite(Date.parse(post.dueAt))
      ? post.dueAt
      : delivery.due_at;
  const sent =
    post.sentAt && Number.isFinite(Date.parse(post.sentAt))
      ? post.sentAt
      : null;
  const statements = [
    env.DB.prepare(
      "UPDATE buffer_deliveries SET post_id=?,status=?,due_at=?,sent_at=?,url=?,error=?,updated_at=?,checked_at=?,next_check_at=? WHERE id=? AND status NOT IN ('cancelled','cancelling')",
    ).bind(
      post.id,
      status,
      due,
      sent,
      safeLink(post.externalLink),
      status === "error"
        ? "Falha de publicação. Abra o Buffer para corrigir; não crie outra cópia."
        : "",
      at,
      at,
      new Date(
        Math.max(Date.now() + 3600000, Date.parse(due ?? at)),
      ).toISOString(),
      delivery.id,
    ),
  ];
  if (status === "sent" && sent)
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO editorial_publications(item_id,channel,version_id,published_at,url,note,actor) SELECT ?,?,?,?,?,'Confirmado pela API do Buffer','buffer' WHERE EXISTS(SELECT 1 FROM buffer_deliveries WHERE id=? AND status='sent')",
      ).bind(
        delivery.item_id,
        delivery.service,
        delivery.version_id,
        sent,
        safeLink(post.externalLink),
        delivery.id,
      ),
    );
  statements.push(
    env.DB.prepare(
      "INSERT INTO editorial_actions(id,item_id,created_at,action,details_json,actor) VALUES(?,?,?,?,?,'buffer')",
    ).bind(
      crypto.randomUUID(),
      delivery.item_id,
      at,
      "buffer_status",
      JSON.stringify({ deliveryId: delivery.id, status, postId: post.id }),
    ),
  );
  await env.DB.batch(statements);
}
export async function syncBuffer(env: BufferEnv, itemId?: string) {
  if (!env.BUFFER_API_KEY) return;
  const at = now();
  // A lost response is never retried as a new post.
  await env.DB.prepare(
    "UPDATE buffer_deliveries SET status='uncertain',error='Envio interrompido. Confira no Buffer antes de liberar outra tentativa.' WHERE status IN ('sending','cancelling') AND updated_at<?",
  )
    .bind(new Date(Date.now() - 120000).toISOString())
    .run();
  const deliveries = (
    await env.DB.prepare(
      `SELECT * FROM buffer_deliveries WHERE post_id IS NOT NULL AND status NOT IN ('sent','cancelled','rejected','cancelling') AND next_check_at<=? ${itemId ? "AND item_id=?" : ""} ORDER BY next_check_at LIMIT 3`,
    )
      .bind(...(itemId ? [at, itemId] : [at]))
      .all<Delivery>()
  ).results;
  for (const delivery of deliveries) {
    // Claim a polling window to avoid simultaneous page loads/cron consuming quota.
    const claimed = await env.DB.prepare(
      "UPDATE buffer_deliveries SET next_check_at=? WHERE id=? AND next_check_at<=?",
    )
      .bind(new Date(Date.now() + 3600000).toISOString(), delivery.id, at)
      .run();
    if (!claimed.meta.changes) continue;
    try {
      const data = await bufferGraph(
        env,
        `query Post($input: PostInput!) { post(input:$input) { ${postFields} } }`,
        { input: { id: delivery.post_id } },
      );
      await recordPost(env, delivery, data.post);
    } catch {
      await env.DB.prepare(
        "UPDATE buffer_deliveries SET error='Não foi possível consultar o Buffer. Nova tentativa nas próximas consultas.',updated_at=? WHERE id=?",
      )
        .bind(now(), delivery.id)
        .run();
    }
  }
}
export async function publicBufferMedia(
  request: Request,
  env: BufferEnv,
): Promise<Response> {
  const id = new URL(request.url).pathname.split("/").at(-1)!;
  if (
    !env.MEDIA ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    !["GET", "HEAD"].includes(request.method)
  )
    return new Response("Not found", { status: 404 });
  const asset = await env.DB.prepare(
    "SELECT mime,created_at FROM buffer_assets WHERE id=?",
  )
    .bind(id)
    .first<{ mime: string; created_at: string }>();
  if (!asset || Date.parse(asset.created_at) < Date.now() - 90 * 86400000)
    return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(id, { range: request.headers });
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Content-Type": asset.mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes",
    ETag: object.httpEtag,
  });
  let status = 200;
  if (
    object.range &&
    "offset" in object.range &&
    object.range.offset !== undefined &&
    "length" in object.range &&
    object.range.length !== undefined
  ) {
    status = 206;
    headers.set(
      "Content-Range",
      `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`,
    );
    headers.set("Content-Length", String(object.range.length));
  } else headers.set("Content-Length", String(object.size));
  return new Response(request.method === "HEAD" ? null : object.body, {
    headers,
    status,
  });
}
async function route(
  request: Request,
  env: BufferEnv,
  readBody: (r: Request) => Promise<unknown>,
) {
  const url = new URL(request.url),
    path = url.pathname.replace("/api/buffer", "");
  if (path === "/status" && request.method === "GET") {
    const mappings = (
      await env.DB.prepare("SELECT * FROM buffer_channels").all()
    ).results;
    return reply({
      keyConfigured: !!env.BUFFER_API_KEY,
      storageConfigured: !!env.MEDIA,
      mappings,
    });
  }
  if (path === "/discover" && request.method === "POST") {
    const account = await bufferGraph(
      env,
      "query { account { organizations { id } } }",
    );
    const found = [];
    for (const org of account.account.organizations)
      for (const channel of await channels(env, org.id)) {
        if (BUFFER_SERVICES.includes(channel.service as any))
          found.push({ ...channel, organizationId: org.id });
      }
    return reply({ channels: found });
  }
  if (path === "/channels" && request.method === "POST") {
    const input = z
      .array(
        z.object({
          service: z.enum(BUFFER_SERVICES),
          channelId: z.string().min(1).max(150),
          organizationId: z.string().min(1).max(150),
        }),
      )
      .min(1)
      .max(3)
      .parse(await readBody(request));
    if (new Set(input.map((i) => i.service)).size !== input.length)
      throw new Error("Escolha um perfil por rede.");
    const verified = [];
    for (const mapping of input) {
      const channel = (await channels(env, mapping.organizationId)).find(
        (c) => c.id === mapping.channelId && c.service === mapping.service,
      );
      if (!channel || channel.isDisconnected || channel.isLocked)
        throw new Error(
          "Conecte e desbloqueie o perfil no Buffer antes de salvar.",
        );
      verified.push({ ...mapping, name: channel.displayName || channel.name });
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM buffer_channels"),
      ...verified.map((c) =>
        env.DB.prepare("INSERT INTO buffer_channels VALUES(?,?,?,?,?)").bind(
          c.service,
          c.channelId,
          c.name,
          c.organizationId,
          now(),
        ),
      ),
    ]);
    return reply({ ok: true });
  }
  if (path === "/assets" && request.method === "POST") {
    if (!env.MEDIA)
      throw new Error(
        "Configure o armazenamento R2 MEDIA antes de preparar os arquivos.",
      );
    const versionId = z
      .string()
      .min(1)
      .max(150)
      .parse(url.searchParams.get("version"));
    await version(env, versionId);
    const mime = request.headers.get("Content-Type");
    if (!["image/png", "video/mp4"].includes(mime ?? ""))
      throw new Error("Envie PNG ou MP4.");
    const limit = mime === "image/png" ? 5 * 1024 * 1024 : 32 * 1024 * 1024;
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Arquivo vazio.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Arquivo excede o limite: PNG 5 MB; MP4 32 MB.");
      }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (
      mime === "image/png"
        ? size < 24 ||
          bytes.slice(0, 8).join(",") !== "137,80,78,71,13,10,26,10" ||
          new DataView(bytes.buffer).getUint32(16) !== 1080 ||
          new DataView(bytes.buffer).getUint32(20) !== 1350
        : size < 12 || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp"
    )
      throw new Error(
        "Arquivo inválido. Gere novamente os materiais no sistema.",
      );
    const id = crypto.randomUUID(),
      hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    await env.MEDIA.put(id, bytes, { httpMetadata: { contentType: mime! } });
    try {
      await env.DB.prepare("INSERT INTO buffer_assets VALUES(?,?,?,?,?,?)")
        .bind(id, versionId, mime, size, hash, now())
        .run();
    } catch (error) {
      await env.MEDIA.delete(id);
      throw error;
    }
    return reply({
      id,
      url: `${url.origin}/api/buffer/media/${id}`,
      mime,
      size,
    });
  }
  if (path === "/deliveries" && request.method === "GET") {
    const item = z.string().min(1).max(150).parse(url.searchParams.get("item"));
    const deliveries = (
      await env.DB.prepare(
        "SELECT * FROM buffer_deliveries WHERE item_id=? ORDER BY created_at DESC",
      )
        .bind(item)
        .all<Delivery>()
    ).results;
    return reply({ deliveries });
  }
  if (path === "/sync" && request.method === "POST") {
    const input = z
      .object({ itemId: z.string().min(1).max(150) })
      .parse(await readBody(request));
    await syncBuffer(env, input.itemId);
    return reply({ ok: true });
  }
  if (path === "/send" && request.method === "POST") {
    const input = sendSchema.parse(await readBody(request));
    // Same request ID always returns its original outcome, even after the version changes.
    const existing = await env.DB.prepare(
      "SELECT * FROM buffer_deliveries WHERE id=?",
    )
      .bind(input.requestId)
      .first<Delivery>();
    if (existing) return reply({ delivery: existing });
    if (!env.MEDIA || !env.BUFFER_API_KEY)
      throw new Error("Configure BUFFER_API_KEY e R2 MEDIA antes de enviar.");
    const v = await version(env, input.versionId);
    if (!v.reviewed_at)
      throw new Error(
        "Confirme a revisão da versão atual antes de aprovar o envio.",
      );
    if (!JSON.parse(v.channels_json).includes(input.service))
      throw new Error("Selecione essa rede no planejamento do conteúdo.");
    const mapping = await env.DB.prepare(
      "SELECT * FROM buffer_channels WHERE service=?",
    )
      .bind(input.service)
      .first<{ channel_id: string; organization_id: string }>();
    if (!mapping) throw new Error("Conecte essa rede na tela Buffer.");
    if (mapping.channel_id !== input.expectedChannelId)
      throw new Error(
        "O perfil selecionado mudou. Reabra o conteúdo e confira o perfil antes de aprovar novamente.",
      );
    const channel = (await channels(env, mapping.organization_id)).find(
      (c) => c.id === mapping.channel_id && c.service === input.service,
    );
    if (
      !channel ||
      channel.isDisconnected ||
      channel.isLocked ||
      channel.isQueuePaused
    )
      throw new Error(
        "O perfil está desconectado, bloqueado ou com a fila pausada no Buffer.",
      );
    const assets = [];
    for (const id of input.assets) {
      const asset = await env.DB.prepare(
        "SELECT * FROM buffer_assets WHERE id=? AND version_id=?",
      )
        .bind(id, input.versionId)
        .first<{ id: string; mime: string; created_at: string }>();
      if (
        !asset ||
        Date.parse(asset.created_at) < Date.now() - 86400000 ||
        !(await env.MEDIA.head(id))
      )
        throw new Error(
          "Prepare os arquivos novamente: material ausente ou expirado.",
        );
      assets.push(asset);
    }
    validateSend(
      input,
      assets.map((a) => a.mime),
    );
    const payload = postInput(
      input,
      mapping.channel_id,
      assets.map((a) => `${url.origin}/api/buffer/media/${a.id}`),
    );
    const at = now();
    // Conditional INSERT + unique index make concurrent approvals safe. Recheck current version and manual publication atomically.
    const insert = await env.DB.prepare(
      `INSERT OR IGNORE INTO buffer_deliveries(id,item_id,version_id,service,channel_id,payload_json,assets_json,status,due_at,created_at,updated_at,next_check_at)
      SELECT ?,?,?,?,?,?,?,'sending',?,?,?,? WHERE EXISTS(SELECT 1 FROM calendar_items i JOIN editorial_versions v ON v.id=i.current_version WHERE i.id=? AND v.id=? AND v.reviewed_at IS NOT NULL AND i.lifecycle='active') AND NOT EXISTS(SELECT 1 FROM editorial_publications WHERE item_id=? AND channel=?)`,
    )
      .bind(
        input.requestId,
        v.item_id,
        input.versionId,
        input.service,
        mapping.channel_id,
        JSON.stringify(payload),
        JSON.stringify(input.assets),
        input.dueAt ?? null,
        at,
        at,
        at,
        v.item_id,
        input.versionId,
        v.item_id,
        input.service,
      )
      .run();
    if (!insert.meta.changes)
      return reply(
        {
          error:
            "Já existe envio/confirmação para esta rede, ou a versão mudou. Atualize o conteúdo.",
        },
        409,
      );
    const delivery = (await env.DB.prepare(
      "SELECT * FROM buffer_deliveries WHERE id=?",
    )
      .bind(input.requestId)
      .first<Delivery>())!;
    try {
      const data = await bufferGraph(
        env,
        `mutation CreatePost($input: CreatePostInput!) { createPost(input:$input) { __typename ... on PostActionSuccess { post { ${postFields} } } ... on MutationError { message } } }`,
        { input: payload },
      );
      if (!data.createPost?.post) {
        const message = String(
          data.createPost?.message ?? "Buffer recusou o envio.",
        )
          .replaceAll(env.BUFFER_API_KEY, "[redacted]")
          .slice(0, 500);
        if (data.createPost?.message) throw new RemoteError(message, true);
        throw new RemoteError(
          "Resposta sem confirmação do Buffer. Confira o painel.",
        );
      }
      // Save remote ID before processing status so polling can recover a subsequent DB failure.
      await env.DB.prepare(
        "UPDATE buffer_deliveries SET post_id=?,status='scheduled',updated_at=? WHERE id=?",
      )
        .bind(data.createPost.post.id, now(), delivery.id)
        .run();
      await recordPost(env, delivery, data.createPost.post);
    } catch (error) {
      const definite = error instanceof RemoteError && error.definite;
      await env.DB.prepare(
        "UPDATE buffer_deliveries SET status=?,error=?,updated_at=? WHERE id=?",
      )
        .bind(
          definite ? "rejected" : "uncertain",
          error instanceof RemoteError
            ? error.message
            : "Resultado incerto. Confira o post no Buffer antes de qualquer nova tentativa.",
          now(),
          delivery.id,
        )
        .run();
    }
    return reply({
      delivery: await env.DB.prepare(
        "SELECT * FROM buffer_deliveries WHERE id=?",
      )
        .bind(delivery.id)
        .first(),
    });
  }
  if (path === "/reconcile" && request.method === "POST") {
    const input = z
      .object({
        id: z.string().uuid(),
        postId: z.string().min(1).max(200).optional(),
        noPostConfirmed: z.boolean(),
      })
      .parse(await readBody(request));
    const delivery = await env.DB.prepare(
      "SELECT * FROM buffer_deliveries WHERE id=?",
    )
      .bind(input.id)
      .first<Delivery>();
    if (!delivery || delivery.status !== "uncertain")
      throw new Error(
        "Atualize o conteúdo: esse envio não está pendente de conferência.",
      );
    if (input.postId && !input.noPostConfirmed) {
      const data = await bufferGraph(
        env,
        `query Post($input: PostInput!) { post(input:$input) { ${postFields} } }`,
        { input: { id: input.postId } },
      );
      if (data.post.text !== JSON.parse(delivery.payload_json).text)
        throw new Error(
          "O texto desse post difere do material aprovado. Confira o ID no Buffer.",
        );
      await recordPost(env, delivery, data.post);
    } else if (
      input.noPostConfirmed &&
      !input.postId &&
      Date.parse(delivery.updated_at) < Date.now() - 120000
    ) {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE buffer_deliveries SET status='cancelled',updated_at=?,error='Proprietário confirmou ausência do post no Buffer.' WHERE id=? AND status='uncertain'",
        ).bind(now(), delivery.id),
        env.DB.prepare(
          "INSERT INTO editorial_actions VALUES(?,?,?,?,?,'proprietario')",
        ).bind(
          crypto.randomUUID(),
          delivery.item_id,
          now(),
          "buffer_conferir_ausencia",
          JSON.stringify({ deliveryId: delivery.id }),
        ),
      ]);
    } else
      throw new Error(
        "Informe o ID encontrado ou confirme a ausência do post. Aguarde dois minutos após a última atualização do envio.",
      );
    return reply({ ok: true });
  }
  if (path === "/cancel" && request.method === "POST") {
    const input = z
      .object({ id: z.string().uuid(), confirmed: z.literal(true) })
      .parse(await readBody(request));
    const delivery = await env.DB.prepare(
      "SELECT * FROM buffer_deliveries WHERE id=?",
    )
      .bind(input.id)
      .first<Delivery>();
    if (
      !delivery?.post_id ||
      !["scheduled", "error", "draft", "needs_approval"].includes(
        delivery.status,
      )
    )
      throw new Error(
        "Este envio não pode ser cancelado aqui. Atualize o status e confira o Buffer.",
      );
    const data = await bufferGraph(
      env,
      `query Post($input: PostInput!) { post(input:$input) { ${postFields} } }`,
      { input: { id: delivery.post_id } },
    );
    if (data.post.status === "sent" || data.post.status === "sending") {
      await recordPost(env, delivery, data.post);
      throw new Error(
        "O Buffer já publicou ou está publicando. O post não foi excluído.",
      );
    }
    const claim = await env.DB.prepare(
      "UPDATE buffer_deliveries SET status='cancelling',updated_at=? WHERE id=? AND status=?",
    )
      .bind(now(), delivery.id, delivery.status)
      .run();
    if (!claim.meta.changes)
      throw new Error("O envio mudou. Atualize antes de cancelar.");
    try {
      const result = await bufferGraph(
        env,
        "mutation Cancel($input: DeletePostInput!) { deletePost(input:$input) { __typename ... on VoidMutationError { message } } }",
        { input: { id: delivery.post_id } },
      );
      if (result.deletePost?.__typename !== "DeletePostSuccess")
        throw new Error("Cancelamento não confirmado. Confira no Buffer.");
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE buffer_deliveries SET status='cancelled',error='',updated_at=? WHERE id=?",
        ).bind(now(), delivery.id),
        env.DB.prepare(
          "INSERT INTO editorial_actions VALUES(?,?,?,?,?,'proprietario')",
        ).bind(
          crypto.randomUUID(),
          delivery.item_id,
          now(),
          "buffer_cancelar",
          JSON.stringify({ deliveryId: delivery.id, postId: delivery.post_id }),
        ),
      ]);
    } catch (error) {
      await env.DB.prepare(
        "UPDATE buffer_deliveries SET status='uncertain',error='Cancelamento não confirmado. Confira a fila e os publicados no Buffer.',updated_at=? WHERE id=?",
      )
        .bind(now(), delivery.id)
        .run();
      throw error;
    }
    return reply({ ok: true });
  }
  return reply({ error: "Rota não encontrada." }, 404);
}
export async function bufferApi(
  request: Request,
  env: BufferEnv,
  readBody: (r: Request) => Promise<unknown>,
) {
  try {
    return await route(request, env, readBody);
  } catch (error) {
    return reply(
      {
        error:
          error instanceof z.ZodError
            ? "Confira os campos e a aprovação do envio."
            : error instanceof Error
              ? error.message
              : "Falha na integração Buffer.",
      },
      400,
    );
  }
}
