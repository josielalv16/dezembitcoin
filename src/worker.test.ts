import { afterEach, describe, it, expect, vi } from "vitest";
import worker, { capture } from "./worker";
function database(existing = false) {
  const saved: unknown[][] = [];
  const db = {
    prepare: (sql: string) => {
      let args: unknown[] = [];
      return {
        bind: (...a: unknown[]) => {
          args = a;
          return {
            first: async () =>
              sql.includes("WHERE day=") && existing ? { id: "exists" } : null,
            run: async () => {
              saved.push(args);
              return {};
            },
          };
        },
        first: async () => null,
      };
    },
    batch: async (statements: unknown[]) => {
      saved.push(statements);
      return [];
    },
  };
  return { db: db as unknown as D1Database, saved };
}
afterEach(() => vi.unstubAllGlobals());
describe("quote collection", () => {
  it("does not fetch again after a successful scheduled capture", async () => {
    const { db } = database(true),
      fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await capture({ DB: db, ASSETS: {} as Fetcher }, "midday"),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("records failed provider responses without saving a quote", async () => {
    const { db, saved } = database();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              success: true,
              market: "BTC-BRL",
              last: -1,
              timestamp: "now",
            }),
            { status: 200 },
          ),
        ),
    );
    await expect(
      capture({ DB: db, ASSETS: {} as Fetcher }, "close"),
    ).rejects.toThrow("Não foi possível consultar");
    expect(saved).toHaveLength(1);
    expect(saved[0][3]).toBe(0);
  });
  it("fails closed when the production password is not configured", async () => {
    const { db } = database();
    const result = await worker.fetch(
      new Request("https://example.com/api/data"),
      { DB: db, ASSETS: {} as Fetcher },
    );
    expect(result.status).toBe(401);
  });
  it("rejects cross-origin writes before touching the database", async () => {
    const { db, saved } = database();
    const result = await worker.fetch(
      new Request("https://example.com/api/purchases", {
        method: "POST",
        headers: { Origin: "https://other.example" },
      }),
      { DB: db, ASSETS: {} as Fetcher },
    );
    expect(result.status).toBe(403);
    expect(saved).toHaveLength(0);
  });
});
