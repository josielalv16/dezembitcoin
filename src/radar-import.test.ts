import { describe, it, expect, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { parseRadarPackage } from "./radar-import";
import { importRadar } from "./radar-api";
const dbs: DatabaseSync[] = [];
afterEach(() => dbs.splice(0).forEach((db) => db.close()));
export function examplePackage() {
  return {
    format: "dezembitcoin.radar",
    version: 1,
    weekStart: "2026-09-07",
    weekEnd: "2026-09-11",
    researchedAt: "2026-09-11T00:00:00-03:00",
    selectionNote: "Exemplo fictício para testar o formato, não publicar.",
    stories: Array.from({ length: 4 }, (_, index) => ({
      title: `Exemplo fictício ${index + 1}`,
      eventDate: "2026-09-10",
      summary: "Resumo de teste",
      context: "Contexto de teste",
      commentary: "Comentário de teste",
      classification: "analise",
      sources: [
        {
          name: "Fonte de teste",
          title: "Artigo fictício",
          url: `https://example.com/noticia-${index}`,
          publishedAt: "2026-09-10T12:00:00-03:00",
        },
      ],
      pages: ["CAPA", "NOTÍCIA", "CONTEXTO", "ANÁLISE", "FONTES"].map(
        (label) => ({
          title: `${label} de teste`,
          body: "Texto fictício para conferir a importação e as prévias do carrossel. Não representa uma notícia real.",
          label,
          sourceIndexes: [0],
        }),
      ),
      captions: {
        instagram: "Legenda de teste Instagram",
        threads: "Legenda de teste Threads",
        tiktok: "Legenda de teste TikTok",
      },
    })),
  };
}
function fixture() {
  const sql = new DatabaseSync(":memory:");
  dbs.push(sql);
  sql.exec("PRAGMA foreign_keys=ON");
  for (const file of [
    "0001_initial.sql",
    "0002_editorial.sql",
    "0003_buffer.sql",
  ])
    sql.exec(readFileSync(`migrations/${file}`, "utf8"));
  const db = {
    prepare(query: string) {
      let args: any[] = [];
      const statement = {
        bind(...values: any[]) {
          args = values;
          return statement;
        },
        async run() {
          return {
            meta: { changes: Number(sql.prepare(query).run(...args).changes) },
          };
        },
      };
      return statement;
    },
    async batch(statements: any[]) {
      sql.exec("BEGIN");
      try {
        const r = [];
        for (const s of statements) r.push(await s.run());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
  return { sql, db };
}
describe("Codex Radar import", () => {
  it("creates four independent unreviewed carousels with exact texts and provenance", async () => {
    const f = fixture(),
      p = examplePackage();
    expect((await importRadar(f.db, p)).created).toBe(4);
    const rows = f.sql
      .prepare("SELECT * FROM editorial_versions")
      .all() as any[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.reviewed_at).toBeNull();
      const s = JSON.parse(row.snapshot_json);
      expect(s.pages.map((page: any) => page.body)).toEqual(
        p.stories[0].pages.map((page) => page.body),
      );
      expect(s.research.story.sources).toHaveLength(1);
      expect(s.captions.tiktok).toBe(p.stories[0].captions.tiktok);
    }
    expect(
      f.sql.prepare("SELECT * FROM editorial_publications").all(),
    ).toHaveLength(0);
    expect(f.sql.prepare("SELECT * FROM buffer_deliveries").all()).toHaveLength(
      0,
    );
  });
  it("reimport does not overwrite edited/reviewed versions and ignores tracking parameters", async () => {
    const f = fixture(),
      p = examplePackage();
    await importRadar(f.db, p);
    f.sql.exec("UPDATE editorial_versions SET reviewed_at='2026-09-11'");
    p.stories[0].sources[0].url += "?utm_source=changed";
    p.stories[0].title = "Título alterado";
    expect(await importRadar(f.db, p)).toMatchObject({
      created: 0,
      skipped: 4,
    });
    expect(
      f.sql.prepare("SELECT * FROM editorial_versions").all(),
    ).toHaveLength(4);
    expect(
      f.sql
        .prepare("SELECT * FROM editorial_versions WHERE reviewed_at IS NULL")
        .all(),
    ).toHaveLength(0);
  });
  it("rolls back the entire package on storage failure", async () => {
    const f = fixture();
    f.sql.exec(
      "CREATE TRIGGER failure BEFORE INSERT ON editorial_versions BEGIN SELECT RAISE(ABORT,'test'); END",
    );
    await expect(importRadar(f.db, examplePackage())).rejects.toThrow();
    expect(f.sql.prepare("SELECT * FROM calendar_items").all()).toHaveLength(0);
  });
  it("rejects out-of-week news, future sources and invalid source references", () => {
    const p = examplePackage();
    p.stories[0].eventDate = "2026-09-01";
    expect(() => parseRadarPackage(p)).toThrow();
    p.stories[0].eventDate = "2026-09-10";
    p.stories[0].sources[0].publishedAt = "2026-09-12T12:00:00Z";
    expect(() => parseRadarPackage(p)).toThrow();
    p.stories[0].sources[0].publishedAt = "2026-09-10T12:00:00Z";
    p.stories[0].pages[0].sourceIndexes = [2];
    expect(() => parseRadarPackage(p)).toThrow();
  });
  it("rejects malicious URLs, unexpected approval fields, duplicates and excess pages", () => {
    const p = examplePackage();
    p.stories[0].sources[0].url = "javascript:alert(1)";
    expect(() => parseRadarPackage(p)).toThrow();
    expect(() =>
      parseRadarPackage({ ...examplePackage(), approved: true }),
    ).toThrow();
    const dup = examplePackage();
    dup.stories[1] = dup.stories[0];
    expect(() => parseRadarPackage(dup)).toThrow();
    const long = examplePackage();
    long.stories[0].pages = Array(9).fill(long.stories[0].pages[0]);
    expect(() => parseRadarPackage(long)).toThrow();
  });
  it("requires explanation when fewer than four verified stories are available", () => {
    const p = examplePackage();
    p.stories = p.stories.slice(0, 2);
    p.selectionNote = "";
    expect(() => parseRadarPackage(p)).toThrow();
    p.selectionNote = "Só duas notícias tiveram fontes suficientes.";
    expect(parseRadarPackage(p).stories).toHaveLength(2);
  });
});
