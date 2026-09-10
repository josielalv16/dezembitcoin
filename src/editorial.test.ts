import { describe, it, expect } from "vitest";
import {
  planMonth,
  readiness,
  itemState,
  buildEditorial,
  normalizeUrl,
  type CalendarItem,
  type Publication,
} from "./editorial-domain";
import { evaluateMilestones, type Definition } from "./editorial-milestones";
import type { Purchase, Quote } from "./domain";
const purchase = (date: string, id = date): Purchase => ({
  id,
  operation_id: null,
  purchased_at: date + "T16:00:00.000Z",
  gross_sats: 2479,
  fee_sats: 12,
  contribution_cents: 1000,
  total_cents: 995,
  price: "403296",
  note: "",
  created_at: date,
  updated_at: date,
});
const quote = (date: string, price = "403296"): Quote => ({
  id: date,
  day: date,
  kind: "close",
  price,
  captured_at: date + "T23:00:00.000Z",
  source_timestamp: "",
  source: "fixture",
  raw_json: "{}",
});
const item = (kind = "weekly"): CalendarItem => ({
  id: "item",
  origin_key: "test",
  planned_date: "2026-09-12",
  deadline: "2026-09-12",
  kind,
  title: "Resumo",
  period_start: "2026-09-09",
  period_end: "2026-09-11",
  note: "",
  lifecycle: "active",
  cancel_reason: "",
  extra: 0,
  channels_json: '["instagram","threads","youtube"]',
  current_version: null,
  revision: 1,
  created_at: "",
  updated_at: "",
});
const def = (metric: string, target: string): Definition => ({
  id: metric,
  metric,
  target,
  title: metric,
  active: 1,
});
describe("calendar", () => {
  it("can prepare educational posts ahead without future financial data", () =>
    expect(readiness(item("education"), [], [], [], "2026-09-09")).toEqual([]));
  it("blocks a daily post when the only quote precedes its purchase", () => {
    const i = { ...item("daily"), period_start: "2026-09-11" };
    expect(
      readiness(
        i,
        [purchase("2026-09-11")],
        [{ ...quote("2026-09-11"), captured_at: "2026-09-11T15:00:00.000Z" }],
        [],
        "2026-09-12",
      ).join(" "),
    ).toContain("após a compra");
  });
  it("does not schedule a financial period before the challenge", () =>
    expect(planMonth("2026-09").every((p) => p.start >= "2026-09-09")).toBe(
      true,
    ));
  it("creates daily and complementary items separately from challenge start", () => {
    const p = planMonth("2026-09");
    expect(p).toHaveLength(44);
    expect(p.filter((p) => p.date === "2026-09-09").map((p) => p.kind)).toEqual(
      ["daily", "fees"],
    );
    expect(new Set(p.map((p) => p.key)).size).toBe(p.length);
  });
  it("handles leap February and schedules previous-month summaries", () => {
    const p = planMonth("2028-02", 28);
    expect(p.filter((p) => p.kind === "daily")).toHaveLength(29);
    expect(p.filter((p) => p.key.startsWith("monthly:"))).toHaveLength(9);
    expect(p.every((p) => p.date <= "2028-02-29")).toBe(true);
    expect(p.find((p) => p.kind === "monthly")?.end).toBe("2028-01-31");
  });
  it("radar includes Friday and begins Saturday", () => {
    const radar = planMonth("2026-09").find(
      (p) => p.kind === "radar" && p.date === "2026-09-18",
    )!;
    expect([radar.start, radar.end]).toEqual(["2026-09-12", "2026-09-18"]);
  });
  it("retains stable origin keys on regeneration", () =>
    expect(planMonth("2026-10", 1).map((p) => p.key)).toEqual(
      planMonth("2026-10", 10).map((p) => p.key),
    ));
  it("requires a real closing quote for monthly content", () => {
    const i = { ...item("monthly"), period_end: "2026-09-30" };
    expect(
      readiness(
        i,
        [purchase("2026-09-09")],
        [{ ...quote("2026-09-30"), kind: "manual" }],
        [],
        "2026-10-01",
      ).join(" "),
    ).toContain("Falta cotação");
  });
  it("requires personal observations and does not manufacture subjective text", () =>
    expect(
      readiness(
        item("difficulty"),
        [purchase("2026-09-09")],
        [quote("2026-09-11")],
        [],
        "2026-09-12",
      ),
    ).toContain("Registre sua observação pessoal para este conteúdo."));
  it("separates generation, review, partial publication and completion", () => {
    const i = { ...item(), current_version: "v" };
    const p = (channel: string): Publication => ({
      item_id: i.id,
      channel,
      version_id: "v",
      published_at: "",
      url: "",
      note: "",
    });
    expect(itemState(i, [], false, [])).toBe("gerado");
    expect(itemState(i, [], true, [])).toBe("revisado");
    expect(itemState(i, [p("instagram")], true, [])).toBe(
      "publicado_parcialmente",
    );
    expect(
      itemState(i, ["instagram", "threads", "youtube"].map(p), true, []),
    ).toBe("publicado");
  });
  it("preserves exact financial data and quotes in snapshots", () => {
    const s = buildEditorial(
      item(),
      [purchase("2026-09-09")],
      [quote("2026-09-11")],
      [],
      "2026-09-12",
    );
    expect(s.financial?.sats).toBe(2467);
    expect(s.financial?.contributed).toBe("10");
    expect(s.pages.length).toBeGreaterThan(3);
    expect(s.financial?.quote.id).toBe("2026-09-11");
  });
  it("normalizes tracked URLs and rejects unsafe schemes", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&n=1#x")).toBe(
      "https://example.com/a?n=1",
    );
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
  });
});
describe("milestones", () => {
  it("does not confuse new contributions with a positive month", () => {
    const p = [purchase("2026-09-09"), purchase("2026-10-01")].map((p) => ({
        ...p,
        gross_sats: 100000,
        fee_sats: 0,
        price: "10000",
      })),
      q = [quote("2026-09-30", "10000"), quote("2026-10-31", "10000")];
    expect(
      evaluateMilestones([def("positive_month", "1")], p, q, "2026-11-01"),
    ).toHaveLength(0);
    q[1].price = "11000";
    expect(
      evaluateMilestones([def("positive_month", "1")], p, q, "2026-11-01")[0]
        .value,
    ).toBe("2");
  });
  it("counts calendar days, bought days and uninterrupted streak independently", () => {
    const p = [
      purchase("2026-09-09"),
      purchase("2026-09-11"),
      purchase("2026-09-12"),
    ];
    const result = evaluateMilestones(
      [
        def("calendar_days", "4"),
        def("purchase_days", "3"),
        def("streak", "3"),
      ],
      p,
      [],
      "2026-09-12",
    );
    expect(result.map((v) => v.definitionId)).toEqual([
      "calendar_days",
      "purchase_days",
    ]);
  });
  it("aggregates multiple buys in a day only once for consistency", () => {
    const p = [purchase("2026-09-09", "a"), purchase("2026-09-09", "b")];
    expect(
      evaluateMilestones([def("purchase_days", "2")], p, [], "2026-09-10"),
    ).toHaveLength(0);
    expect(
      evaluateMilestones([def("contributions", "20")], p, [], "2026-09-10"),
    ).toHaveLength(1);
  });
  it("detects the first wallet crossing even after price falls", () => {
    const qs = [
      quote("2026-09-09", "500000"),
      quote("2026-09-10", "200000"),
      quote("2026-09-11", "900000"),
    ];
    const r = evaluateMilestones(
      [def("wallet", "10")],
      [purchase("2026-09-09")],
      qs,
      "2026-09-12",
    );
    expect(r).toHaveLength(1);
    expect(r[0].quote?.day).toBe("2026-09-09");
  });
  it("never uses purchases later than a quote for wallet milestones", () => {
    const qs = [
      {
        ...quote("2026-09-09", "500000"),
        captured_at: "2026-09-09T15:00:00.000Z",
      },
    ];
    expect(
      evaluateMilestones(
        [def("wallet", "10")],
        [purchase("2026-09-09")],
        qs,
        "2026-09-12",
      ),
    ).toHaveLength(0);
  });
  it("uses net satoshis", () => {
    expect(
      evaluateMilestones(
        [def("sats", "2470")],
        [purchase("2026-09-09")],
        [],
        "2026-09-10",
      ),
    ).toHaveLength(0);
  });
  it("requires a negative result before the first recovery", () => {
    const p = [purchase("2026-09-09")],
      qs = [
        quote("2026-09-09", "500000"),
        quote("2026-09-10", "200000"),
        quote("2026-09-11", "500000"),
      ];
    const r = evaluateMilestones([def("recovery", "1")], p, qs, "2026-09-12");
    expect(r[0].quote?.day).toBe("2026-09-11");
  });
  it("does not count partial starting month as a full month", () =>
    expect(
      evaluateMilestones(
        [def("complete_month", "1")],
        Array.from({ length: 22 }, (_, n) =>
          purchase("2026-09-" + String(n + 9).padStart(2, "0")),
        ),
        [],
        "2026-10-01",
      ),
    ).toHaveLength(0));
});
