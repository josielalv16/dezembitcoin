import { describe, it, expect } from "vitest";
import {
  makeSnapshot,
  purchaseSchema,
  totals,
  localDay,
  dayNumber,
  type Purchase,
  type Quote,
} from "./domain";
const purchase: Purchase = {
  id: "p1",
  operation_id: "test",
  purchased_at: "2026-09-09T17:32:09.000Z",
  gross_sats: 2479,
  fee_sats: 12,
  price: "403296",
  total_cents: 995,
  contribution_cents: 1000,
  note: "",
  created_at: "",
  updated_at: "",
};
const quote: Quote = {
  id: "q1",
  day: "2026-09-09",
  kind: "manual",
  price: "403296.01",
  captured_at: "2026-09-09T17:40:00.000Z",
  source_timestamp: "2026-09-09 14:39:01",
  source: "Bitpreço / last",
  raw_json: "{}",
};
describe("financial ledger", () => {
  it("deducts the BTC fee once and includes it in cash cost", () => {
    const t = totals([purchase], quote.price);
    expect(t.sats).toBe(2467);
    expect(t.contributed).toBe("10");
    expect(t.value).toBe("9.9493125667");
    expect(Number(t.percent)).toBeCloseTo(-0.506874333, 9);
  });
  it("does not use an afternoon purchase in a midday valuation", () => {
    expect(() =>
      makeSnapshot(
        [purchase],
        [{ ...quote, captured_at: "2026-09-09T15:00:00.000Z" }],
        "daily",
        quote.day,
        quote.day,
        quote.id,
      ),
    ).toThrow("Não há compras");
  });
  it("selects the original quote for a historical post", () => {
    const s = makeSnapshot(
      [purchase],
      [
        quote,
        {
          ...quote,
          id: "later",
          day: "2026-09-10",
          captured_at: "2026-09-10T15:00:00.000Z",
          price: "999999",
        },
      ],
      "daily",
      quote.day,
      quote.day,
      quote.id,
    );
    expect(s.value).toBe("9.9493125667");
    expect(s.captions.instagram).toContain("R$ 9,95");
  });
  it("subtracts contributions from weekly gain", () => {
    const p2 = {
      ...purchase,
      id: "p2",
      purchased_at: "2026-09-10T17:00:00.000Z",
    };
    const q0 = {
      ...quote,
      kind: "close" as const,
      captured_at: "2026-09-10T02:55:00.000Z",
    };
    const q2 = {
      ...quote,
      id: "q2",
      day: "2026-09-10",
      price: "410000",
      captured_at: "2026-09-11T02:55:00.000Z",
      kind: "close" as const,
    };
    const s = makeSnapshot(
      [purchase, p2],
      [q0, q2],
      "weekly",
      "2026-09-10",
      "2026-09-10",
      "q2",
    );
    expect(Number(s.periodResult)).toBeCloseTo(20.2294 - 9.9493125667 - 10, 8);
  });
  it("flags missing opening quote without inventing a period return", () => {
    const q2 = {
      ...quote,
      id: "q2",
      day: "2026-09-10",
      captured_at: "2026-09-11T02:55:00.000Z",
    };
    const p2 = { ...purchase, purchased_at: "2026-09-10T17:00:00.000Z" };
    const s = makeSnapshot(
      [purchase, p2],
      [q2],
      "weekly",
      "2026-09-10",
      "2026-09-10",
      "q2",
    );
    expect(s.periodResult).toBeNull();
  });
  it("uses Brasilia date at UTC midnight and calendar days for challenge", () => {
    expect(localDay("2026-09-10T02:55:00Z")).toBe("2026-09-09");
    expect(dayNumber("2026-09-10")).toBe(2);
  });
  it("rejects sub-satoshi quantities and excessive fees", () => {
    const input = {
      operation_id: "",
      purchased_at: purchase.purchased_at,
      quantity: "0.000024791",
      fee: "0",
      price: "403296",
      total: "9.95",
      contribution: "10",
      note: "",
    };
    expect(purchaseSchema.safeParse(input).success).toBe(false);
    expect(
      purchaseSchema.safeParse({
        ...input,
        quantity: "0.00002479",
        fee: "0.00002479",
      }).success,
    ).toBe(false);
  });
  it("refuses a quote from another date", () => {
    expect(() =>
      makeSnapshot(
        [purchase],
        [quote],
        "daily",
        "2026-09-10",
        "2026-09-10",
        quote.id,
      ),
    ).toThrow("Escolha");
  });
  it("reports malformed numeric input as validation error, without throwing", () => {
    expect(
      purchaseSchema.safeParse({
        purchased_at: purchase.purchased_at,
        quantity: "abc",
        fee: "0",
        price: "1",
        total: "1",
        contribution: "1",
      }).success,
    ).toBe(false);
  });
  it("can report a day without new purchases using the existing balance", () => {
    const next = {
      ...quote,
      id: "q2",
      day: "2026-09-10",
      captured_at: "2026-09-10T15:00:00.000Z",
    };
    const s = makeSnapshot(
      [purchase],
      [next],
      "daily",
      "2026-09-10",
      "2026-09-10",
      "q2",
    );
    expect(s.periodContribution).toBe("0");
    expect(s.sats).toBe(2467);
    expect(s.missingDays).toEqual(["2026-09-10"]);
  });
  it("flags an opening position with a purchase after the previous closing capture", () => {
    const late = { ...purchase, purchased_at: "2026-09-10T02:58:00.000Z" };
    const next = {
      ...purchase,
      id: "p2",
      purchased_at: "2026-09-10T17:00:00.000Z",
    };
    const previous = {
      ...quote,
      kind: "close" as const,
      captured_at: "2026-09-10T02:55:00.000Z",
    };
    const final = {
      ...quote,
      id: "q2",
      day: "2026-09-10",
      kind: "close" as const,
      captured_at: "2026-09-11T02:55:00.000Z",
    };
    const s = makeSnapshot(
      [late, next],
      [previous, final],
      "weekly",
      "2026-09-10",
      "2026-09-10",
      "q2",
    );
    expect(s.periodResult).toBeNull();
  });
});
