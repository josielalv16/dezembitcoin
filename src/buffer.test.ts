import { describe, it, expect, vi, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  bufferApi,
  syncBuffer,
  publicBufferMedia,
  type BufferEnv,
  bufferGraph,
} from "./buffer-api";
import {
  postInput,
  remoteStatus,
  sendSchema,
  validateSend,
} from "./buffer-domain";
const connections: DatabaseSync[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  connections.splice(0).forEach((db) => db.close());
});
const assetId = "ad3f6c1e-eeb7-42be-a2d9-b568cd1c378a";
describe("Buffer GraphQL diagnostics", () => {
  it("keeps validation details without leaking the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          errors: [
            {
              message:
                'Variable "$input" got invalid value: Field "shouldShareToFeed" of required type "Boolean!" was not provided. secret-test',
              extensions: { code: "BAD_USER_INPUT" },
            },
          ],
        }),
      ),
    );
    await expect(
      bufferGraph(
        { DB: {} as D1Database, BUFFER_API_KEY: "secret-test" },
        "unused",
      ),
    ).rejects.toMatchObject({
      definite: true,
      message: expect.stringContaining('"shouldShareToFeed"'),
    });
    await expect(
      bufferGraph(
        { DB: {} as D1Database, BUFFER_API_KEY: "secret-test" },
        "unused",
      ),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining("secret-test"),
    });
  });
  it.each([
    {
      errors: [
        {
          message: "Resolver failed",
          extensions: { code: "INTERNAL_SERVER_ERROR" },
          path: ["createPost"],
        },
      ],
    },
    { errors: [{ message: "Unclassified failure" }] },
    {
      data: { createPost: { post: { id: "existing" } } },
      errors: [
        {
          message: "Partial response",
          extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
        },
      ],
    },
  ])(
    "preserves uncertain status for execution/partial/unknown errors",
    async (response) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(response)),
      );
      await expect(
        bufferGraph({ DB: {} as D1Database, BUFFER_API_KEY: "test" }, "unused"),
      ).rejects.toMatchObject({ definite: false });
    },
  );
});
function fixture(migrateYoutube = true) {
  const sql = new DatabaseSync(":memory:");
  connections.push(sql);
  sql.exec("PRAGMA foreign_keys=ON");
  for (const file of [
    "0001_initial.sql",
    "0002_editorial.sql",
    "0003_buffer.sql",
    ...(migrateYoutube ? ["0004_buffer_youtube.sql"] : []),
  ])
    sql.exec(readFileSync(`migrations/${file}`, "utf8"));
  const prepare = (query: string) => {
    let args: any[] = [];
    const statement = {
      bind: (...values: any[]) => {
        args = values;
        return statement;
      },
      first: async () => sql.prepare(query).get(...args) ?? null,
      all: async () => ({ results: sql.prepare(query).all(...args) }),
      run: async () => ({
        meta: { changes: Number(sql.prepare(query).run(...args).changes) },
      }),
    };
    return statement;
  };
  const db = {
    prepare,
    batch: async (statements: any[]) => {
      sql.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
  const now = new Date().toISOString();
  sql
    .prepare(
      "INSERT INTO calendar_items(id,origin_key,planned_date,deadline,kind,title,period_start,period_end,created_at,updated_at,current_version) VALUES('item','fixture','2026-09-10','2026-09-10','daily','Teste','2026-09-10','2026-09-10',?,?,'version')",
    )
    .run(now, now);
  sql
    .prepare(
      "INSERT INTO editorial_versions VALUES('version','item',?,1,'{}',?)",
    )
    .run(now, now);
  for (const service of ["instagram", "threads", "tiktok"])
    sql
      .prepare("INSERT INTO buffer_channels VALUES(?,?,?,'org',?)")
      .run(service, service + "-channel", service, now);
  sql
    .prepare(
      "INSERT INTO buffer_assets VALUES(?,'version','image/png',100,'hash',?)",
    )
    .run(assetId, now);
  const env: BufferEnv = {
    DB: db,
    BUFFER_API_KEY: "test-only-not-real",
    MEDIA: {
      head: async () => ({ size: 100 }),
      get: async () => ({
        size: 100,
        httpEtag: '"hash"',
        body: new Uint8Array(100),
      }),
    } as unknown as R2Bucket,
  };
  const input = {
    requestId: crypto.randomUUID(),
    versionId: "version",
    expectedChannelId: "instagram-channel",
    service: "instagram",
    text: "Texto aprovado",
    assets: [assetId],
    mode: "customScheduled",
    dueAt: new Date(Date.now() + 3600000).toISOString(),
    approved: true,
  };
  const remote = {
    id: "remote-id",
    channelId: "instagram-channel",
    status: "scheduled",
    dueAt: input.dueAt,
    sentAt: null,
    externalLink: null,
    text: input.text,
  };
  const fetcher = vi.fn(async (_url: any, options: any) => {
    const body = JSON.parse(options.body);
    if (body.query.includes("query Channels"))
      return Response.json({
        data: {
          channels: ["instagram", "threads", "tiktok", "youtube"].map(
            (service) => ({
              id: service + "-channel",
              service,
              name: service,
              displayName: service,
              isDisconnected: false,
              isLocked: false,
              isQueuePaused: false,
            }),
          ),
        },
      });
    if (body.query.includes("mutation CreatePost"))
      return Response.json({
        data: { createPost: { __typename: "PostActionSuccess", post: remote } },
      });
    if (body.query.includes("mutation Cancel"))
      return Response.json({
        data: { deletePost: { __typename: "DeletePostSuccess" } },
      });
    return Response.json({ data: { post: remote } });
  });
  vi.stubGlobal("fetch", fetcher);
  const call = async (path: string, body: unknown) => {
    const response = await bufferApi(
      new Request("https://example.test/api/buffer" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
      (r) => r.json(),
    );
    return { status: response.status, data: (await response.json()) as any };
  };
  const sends = () =>
    fetcher.mock.calls.filter((c) =>
      JSON.parse(c[1].body).query.includes("mutation CreatePost"),
    );
  return { sql, env, input, remote, fetcher, call, sends };
}
describe("Buffer approved publishing with real SQLite constraints", () => {
  it("preserves existing channels, plans and active deliveries during migration", async () => {
    const f = fixture(false);
    await f.call("/send", f.input);
    const channels = f.sql
      .prepare("SELECT * FROM buffer_channels ORDER BY service")
      .all();
    const deliveries = f.sql.prepare("SELECT * FROM buffer_deliveries").all();
    const plans = f.sql.prepare("SELECT * FROM calendar_items").all();
    f.sql.exec(readFileSync("migrations/0004_buffer_youtube.sql", "utf8"));
    expect(
      f.sql.prepare("SELECT * FROM buffer_channels ORDER BY service").all(),
    ).toEqual(channels);
    expect(f.sql.prepare("SELECT * FROM buffer_deliveries").all()).toEqual(
      deliveries,
    );
    expect(f.sql.prepare("SELECT * FROM calendar_items").all()).toEqual(plans);
  });
  function youtubeFixture() {
    const f = fixture();
    f.env.BUFFER_YOUTUBE_API_KEY = "youtube-test-key";
    f.sql
      .prepare(
        "INSERT INTO buffer_channels VALUES('youtube','youtube-channel','YouTube','youtube-org',?)",
      )
      .run(new Date().toISOString());
    f.sql.exec("UPDATE buffer_assets SET mime='video/mp4'");
    f.remote.channelId = "youtube-channel";
    return {
      ...f,
      input: {
        ...f.input,
        service: "youtube",
        expectedChannelId: "youtube-channel",
        youtubeTitle: "Dia de Bitcoin",
      },
    };
  }
  it("routes YouTube creation and polling exclusively to its second account", async () => {
    const f = youtubeFixture();
    const result = await f.call("/send", f.input);
    expect(result.data.delivery.status).toBe("scheduled");
    expect(JSON.parse(f.sends()[0][1].body).variables.input).toMatchObject({
      assets: [{ video: { url: expect.any(String) } }],
      metadata: {
        youtube: {
          title: "Dia de Bitcoin",
          categoryId: "27",
          privacy: "public",
          madeForKids: false,
        },
      },
    });
    f.sql.exec("UPDATE buffer_deliveries SET next_check_at='2000-01-01'");
    f.remote.status = "sent";
    Object.assign(f.remote, { sentAt: new Date().toISOString() });
    await syncBuffer(f.env);
    expect(
      f.sql.prepare("SELECT channel FROM editorial_publications").get(),
    ).toEqual({ channel: "youtube" });
    expect(
      f.fetcher.mock.calls.every(
        (c) => c[1].headers.Authorization === "Bearer youtube-test-key",
      ),
    ).toBe(true);
  });
  it("uses the second key to reconcile and cancel a YouTube post", async () => {
    const f = youtubeFixture();
    await f.call("/send", f.input);
    f.sql.exec("UPDATE buffer_deliveries SET status='uncertain'");
    expect(
      (
        await f.call("/reconcile", {
          id: f.input.requestId,
          postId: f.remote.id,
          noPostConfirmed: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (await f.call("/cancel", { id: f.input.requestId, confirmed: true }))
        .status,
    ).toBe(200);
    expect(
      f.fetcher.mock.calls.every(
        (c) => c[1].headers.Authorization === "Bearer youtube-test-key",
      ),
    ).toBe(true);
  });
  it("never falls back to the primary account when the YouTube key is missing", async () => {
    const f = youtubeFixture();
    delete f.env.BUFFER_YOUTUBE_API_KEY;
    expect((await f.call("/send", f.input)).data.error).toContain(
      "BUFFER_YOUTUBE_API_KEY",
    );
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("keeps Instagram on the primary key even with the YouTube account configured", async () => {
    const f = fixture();
    f.env.BUFFER_YOUTUBE_API_KEY = "youtube-test-key";
    await f.call("/send", f.input);
    expect(
      f.fetcher.mock.calls.every(
        (c) => c[1].headers.Authorization === "Bearer test-only-not-real",
      ),
    ).toBe(true);
  });
  it("validates YouTube title and video before creating a remote post", async () => {
    const f = youtubeFixture();
    expect(
      (await f.call("/send", { ...f.input, youtubeTitle: undefined })).status,
    ).toBe(400);
    expect(
      (await f.call("/send", { ...f.input, youtubeTitle: "x".repeat(101) }))
        .status,
    ).toBe(400);
    f.sql.exec("UPDATE buffer_assets SET mime='image/png'");
    expect((await f.call("/send", f.input)).status).toBe(400);
    expect(f.sends()).toHaveLength(0);
  });
  it("discovers each account separately and saves all four profiles", async () => {
    const f = fixture();
    f.env.BUFFER_YOUTUBE_API_KEY = "youtube-test-key";
    const original = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async (url: any, options: any) =>
      JSON.parse(options.body).query.includes("account { organizations")
        ? Response.json({
            data: {
              account: {
                organizations: [
                  {
                    id:
                      options.headers.Authorization ===
                      "Bearer youtube-test-key"
                        ? "yt-org"
                        : "org",
                  },
                ],
              },
            },
          })
        : original(url, options),
    );
    const found = (await f.call("/discover", {})).data.channels;
    expect(found).toHaveLength(4);
    expect(found.find((c: any) => c.service === "youtube").organizationId).toBe(
      "yt-org",
    );
    expect(
      (
        await f.call(
          "/channels",
          found.map((c: any) => ({
            service: c.service,
            channelId: c.id,
            organizationId: c.organizationId,
          })),
        )
      ).status,
    ).toBe(200);
    expect(f.sql.prepare("SELECT * FROM buffer_channels").all()).toHaveLength(
      4,
    );
    for (const [, options] of f.fetcher.mock.calls) {
      const body = JSON.parse(options.body);
      if (body.query.includes("query Channels"))
        expect(options.headers.Authorization).toBe(
          body.variables.input.organizationId === "yt-org"
            ? "Bearer youtube-test-key"
            : "Bearer test-only-not-real",
        );
    }
  });
  it("rejects missing approval and unreviewed/stale versions without sending", async () => {
    const f = fixture();
    expect(
      (await f.call("/send", { ...f.input, approved: false })).status,
    ).toBe(400);
    f.sql.exec("UPDATE editorial_versions SET reviewed_at=NULL");
    expect((await f.call("/send", f.input)).status).toBe(400);
    f.sql.exec("UPDATE calendar_items SET current_version=NULL");
    expect((await f.call("/send", f.input)).status).toBe(400);
    expect(f.sends()).toHaveLength(0);
  });
  it("schedules exact approved payload and preserves asset order without marking published", async () => {
    const f = fixture();
    const result = await f.call("/send", f.input);
    expect(result.status).toBe(200);
    expect(result.data.delivery.status).toBe("scheduled");
    const payload = JSON.parse(f.sends()[0][1].body).variables.input;
    expect(payload).toMatchObject({
      text: f.input.text,
      channelId: "instagram-channel",
      dueAt: f.input.dueAt,
      schedulingType: "automatic",
      needsApproval: false,
      assets: [
        { image: { url: `https://example.test/api/buffer/media/${assetId}` } },
      ],
    });
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
    expect(() =>
      f.sql.exec("UPDATE calendar_items SET current_version=NULL"),
    ).toThrow();
  });
  it("makes duplicate and concurrent approvals create at most one remote post", async () => {
    const f = fixture();
    await Promise.all([
      f.call("/send", f.input),
      f.call("/send", { ...f.input, requestId: crypto.randomUUID() }),
    ]);
    await f.call("/send", f.input);
    expect(f.sends()).toHaveLength(1);
  });
  it("blocks a manually published network and another network's media", async () => {
    const f = fixture();
    f.sql.exec(
      "INSERT INTO editorial_publications(item_id,channel,published_at) VALUES('item','instagram','2026-09-10T15:00:00Z')",
    );
    expect((await f.call("/send", f.input)).status).toBe(409);
    expect(
      (await f.call("/send", { ...f.input, service: "tiktok" })).status,
    ).toBe(400);
    expect(f.sends()).toHaveLength(0);
  });
  it("rejects cross-version media and paused channels", async () => {
    const f = fixture();
    expect(
      (await f.call("/send", { ...f.input, assets: [crypto.randomUUID()] }))
        .status,
    ).toBe(400);
    f.fetcher.mockImplementation(async () =>
      Response.json({
        data: {
          channels: [
            {
              id: "instagram-channel",
              service: "instagram",
              isQueuePaused: true,
            },
          ],
        },
      }),
    );
    expect((await f.call("/send", f.input)).status).toBe(400);
    expect(f.sends()).toHaveLength(0);
  });
  it("marks published only after confirmed sent, and polling is idempotent", async () => {
    const f = fixture();
    await f.call("/send", f.input);
    f.remote.status = "sent";
    f.remote.sentAt = new Date().toISOString() as any;
    f.remote.externalLink = "https://instagram.com/p/test" as any;
    f.sql.exec("UPDATE buffer_deliveries SET next_check_at='2000-01-01'");
    await syncBuffer(f.env);
    expect(
      f.sql
        .prepare("SELECT actor,channel,url FROM editorial_publications")
        .get(),
    ).toEqual({
      actor: "buffer",
      channel: "instagram",
      url: "https://instagram.com/p/test",
    });
    await syncBuffer(f.env);
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(1);
  });
  it("requires approval for the same profile currently configured", async () => {
    const f = fixture();
    expect(
      (
        await f.call("/send", {
          ...f.input,
          expectedChannelId: "another-profile",
        })
      ).status,
    ).toBe(400);
    expect(f.sends()).toHaveLength(0);
  });
  it("keeps polling a sent post without a valid publication timestamp", async () => {
    const f = fixture();
    f.remote.status = "sent";
    const result = await f.call("/send", f.input);
    expect(result.data.delivery.status).toBe("processing");
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
  });
  it("does not overwrite a cancellation with a stale poll response", async () => {
    const f = fixture();
    await f.call("/send", f.input);
    f.sql.exec("UPDATE buffer_deliveries SET next_check_at='2000-01-01'");
    f.fetcher.mockImplementation(async () => {
      f.sql.exec("UPDATE buffer_deliveries SET status='cancelled'");
      return Response.json({
        data: {
          post: {
            ...f.remote,
            status: "sent",
            sentAt: new Date().toISOString(),
          },
        },
      });
    });
    await syncBuffer(f.env);
    expect(f.sql.prepare("SELECT status FROM buffer_deliveries").get()).toEqual(
      { status: "cancelled" },
    );
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
  });
  it("does not duplicate after a lost response or mark a failed post as published", async () => {
    const f = fixture();
    f.fetcher.mockImplementation(async (_url: any, options: any) =>
      JSON.parse(options.body).query.includes("mutation")
        ? new Response("error", { status: 503 })
        : Response.json({
            data: {
              channels: [{ id: "instagram-channel", service: "instagram" }],
            },
          }),
    );
    const result = await f.call("/send", f.input);
    expect(result.data.delivery.status).toBe("uncertain");
    expect(
      (await f.call("/send", { ...f.input, requestId: crypto.randomUUID() }))
        .status,
    ).toBe(409);
    expect(f.sends()).toHaveLength(1);
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
  });
  it("records a GraphQL input rejection and permits only a new approved attempt", async () => {
    const f = fixture();
    const original = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async (url: any, options: any) =>
      JSON.parse(options.body).query.includes("mutation CreatePost")
        ? Response.json({
            errors: [
              {
                message:
                  'Variable "$input" got invalid value: shouldShareToFeed is required',
                extensions: { code: "BAD_USER_INPUT" },
              },
            ],
          })
        : original(url, options),
    );
    const result = await f.call("/send", f.input);
    expect(result.data.delivery.status).toBe("rejected");
    expect(result.data.delivery.error).toContain("shouldShareToFeed");
    expect(f.sends()).toHaveLength(1);
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
    f.fetcher.mockImplementation(original);
    expect(
      (await f.call("/send", { ...f.input, requestId: crypto.randomUUID() }))
        .data.delivery.status,
    ).toBe("scheduled");
  });
  it("allows a new approved attempt after an explicit provider rejection", async () => {
    const f = fixture();
    const original = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async (url: any, options: any) =>
      JSON.parse(options.body).query.includes("mutation CreatePost")
        ? Response.json({
            data: {
              createPost: {
                __typename: "PostInvalidInputError",
                message: "Invalid post",
              },
            },
          })
        : original(url, options),
    );
    expect((await f.call("/send", f.input)).data.delivery.status).toBe(
      "rejected",
    );
    f.fetcher.mockImplementation(original);
    expect(
      (await f.call("/send", { ...f.input, requestId: crypto.randomUUID() }))
        .data.delivery.status,
    ).toBe("scheduled");
  });
  it("cancels a queued post after explicit confirmation and unlocks the item", async () => {
    const f = fixture();
    await f.call("/send", f.input);
    expect(
      (await f.call("/cancel", { id: f.input.requestId, confirmed: false }))
        .status,
    ).toBe(400);
    expect(
      (await f.call("/cancel", { id: f.input.requestId, confirmed: true }))
        .status,
    ).toBe(200);
    expect(f.sql.prepare("SELECT status FROM buffer_deliveries").get()).toEqual(
      { status: "cancelled" },
    );
    expect(() =>
      f.sql.exec("UPDATE calendar_items SET current_version=NULL"),
    ).not.toThrow();
  });
  it("never deletes a post that has already been sent", async () => {
    const f = fixture();
    await f.call("/send", f.input);
    f.remote.status = "sent";
    f.remote.sentAt = new Date().toISOString() as any;
    expect(
      (await f.call("/cancel", { id: f.input.requestId, confirmed: true }))
        .status,
    ).toBe(400);
    expect(
      f.fetcher.mock.calls.filter((c) =>
        JSON.parse(c[1].body).query.includes("mutation Cancel"),
      ),
    ).toHaveLength(0);
  });
  it("rejects reconciliation to another channel", async () => {
    const f = fixture();
    await f.call("/send", f.input);
    f.sql.exec("UPDATE buffer_deliveries SET status='uncertain'");
    f.remote.channelId = "other-channel";
    expect(
      (
        await f.call("/reconcile", {
          id: f.input.requestId,
          postId: "other",
          noPostConfirmed: false,
        })
      ).status,
    ).toBe(400);
  });
  it("serves only opaque valid media IDs and expires public links", async () => {
    const f = fixture();
    expect(
      (
        await publicBufferMedia(
          new Request(`https://example.test/api/buffer/media/${assetId}`),
          f.env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await publicBufferMedia(
          new Request("https://example.test/api/buffer/media/not-a-token"),
          f.env,
        )
      ).status,
    ).toBe(404);
    f.sql.exec("UPDATE buffer_assets SET created_at='2000-01-01'");
    expect(
      (
        await publicBufferMedia(
          new Request(`https://example.test/api/buffer/media/${assetId}`),
          f.env,
        )
      ).status,
    ).toBe(404);
  });
  it("uses current active networks as defaults for new calendar items", () => {
    const f = fixture();
    expect(
      JSON.parse(
        (f.sql.prepare("SELECT channels_json FROM calendar_items").get() as any)
          .channels_json,
      ),
    ).toEqual(["instagram", "threads", "tiktok", "youtube"]);
  });
});
describe("Buffer media and scheduling rules", () => {
  it("rejects unsupported networks", () => {
    const f = fixture();
    expect(() =>
      sendSchema.parse({ ...f.input, service: "facebook" }),
    ).toThrow();
  });
  it("rejects past/distant dates, oversized Threads captions and mixed media", () => {
    const f = fixture(),
      input = sendSchema.parse(f.input);
    expect(() =>
      validateSend({ ...input, dueAt: "2000-01-01T00:00:00Z" }, ["image/png"]),
    ).toThrow();
    expect(() =>
      validateSend(
        { ...input, dueAt: new Date(Date.now() + 31 * 86400000).toISOString() },
        ["image/png"],
      ),
    ).toThrow();
    expect(() =>
      validateSend({ ...input, service: "threads", text: "a".repeat(501) }, [
        "image/png",
      ]),
    ).toThrow();
    expect(() =>
      validateSend({ ...input, service: "tiktok" }, ["image/png"]),
    ).toThrow();
  });
  it("builds TikTok as video and distinguishes provider states", () => {
    const f = fixture(),
      input = sendSchema.parse({
        ...f.input,
        service: "tiktok",
        mode: "shareNow",
        aiGenerated: true,
      });
    expect(
      postInput(input, "tik", ["https://example.test/video"]),
    ).toMatchObject({
      assets: [{ video: { url: "https://example.test/video" } }],
      metadata: { tiktok: { isAiGenerated: true } },
    });
    expect(remoteStatus("needs_approval")).toBe("needs_approval");
    expect(remoteStatus("sending")).toBe("processing");
    expect(remoteStatus("new-unknown-status")).toBe("uncertain");
  });
  it("includes the required Instagram feed metadata and preserves carousel order", () => {
    const f = fixture();
    const urls = [
      "https://example.test/first.png",
      "https://example.test/second.png",
    ];
    expect(
      postInput(sendSchema.parse(f.input), "instagram-channel", urls),
    ).toMatchObject({
      metadata: { instagram: { type: "post", shouldShareToFeed: true } },
      assets: urls.map((url) => ({ image: { url } })),
    });
  });
});
