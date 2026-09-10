import Decimal from "decimal.js";
import {
  START,
  addDays,
  dayNumber,
  daysBetween,
  localDay,
  brl,
  btc,
  totals,
  type Purchase,
  type Quote,
} from "./domain";
import { monthLast } from "./editorial-domain";
export const METRICS = [
  "calendar_days",
  "purchase_days",
  "streak",
  "contributions",
  "sats",
  "wallet",
  "positive_month",
  "recovery",
  "best_week",
  "fee_record",
  "complete_month",
] as const;
export interface Definition {
  id: string;
  metric: string;
  target: string;
  title: string;
  active: number;
}
export interface Achievement {
  definitionId: string;
  key: string;
  achievedAt: string;
  value: string;
  description: string;
  quote: Quote | null;
  purchaseIds: string[];
}
export function defaultDefinitions(): Definition[] {
  const groups: [string, number[], string][] = [
    ["calendar_days", [7, 30, 60, 100, 180, 365], "dias de desafio"],
    ["purchase_days", [7, 30, 60, 100, 180, 365], "dias com compra"],
    ["streak", [7, 30, 60, 100, 180, 365], "dias seguidos com compra"],
    ["contributions", [100, 500, 1000, 2500, 5000, 10000], "reais aportados"],
    [
      "sats",
      [10000, 50000, 100000, 250000, 500000, 1000000],
      "satoshis acumulados",
    ],
    ["wallet", [100, 500, 1000], "reais na carteira"],
  ];
  const defs = groups.flatMap(([metric, targets, label]) =>
    targets.map((target) => ({
      id: `${metric}-${target}`,
      metric,
      target: String(target),
      title: `${target.toLocaleString("pt-BR")} ${label}`,
      active: 1,
    })),
  );
  for (const [metric, title] of [
    ["positive_month", "Primeiro mês positivo"],
    ["recovery", "Primeira recuperação do resultado"],
    ["best_week", "Novo recorde semanal"],
    ["fee_record", "Nova maior taxa proporcional"],
    ["complete_month", "Primeiro mês completo de compras"],
  ])
    defs.push({ id: metric, metric, target: "1", title, active: 1 });
  return defs;
}
export function evaluateMilestones(
  definitions: Definition[],
  purchases: Purchase[],
  quotes: Quote[],
  today: string,
): Achievement[] {
  const ps = purchases
    .filter((p) => localDay(p.purchased_at) <= today)
    .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
  const qs = quotes
    .filter((q) => q.day <= today)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const days = [...new Set(ps.map((p) => localDay(p.purchased_at)))];
  const output: Achievement[] = [];
  for (const def of definitions.filter((d) => d.active)) {
    const target = new Decimal(def.target);
    const add = (
      date: string,
      value: string,
      description: string,
      quote: Quote | null = null,
      suffix = "",
    ) => {
      const achievedAt = new Date(date).toISOString();
      output.push({
        definitionId: def.id,
        key: def.id + suffix,
        achievedAt,
        value,
        description,
        quote,
        purchaseIds: ps
          .filter((p) => p.purchased_at <= achievedAt)
          .map((p) => p.id),
      });
    };
    if (def.metric === "calendar_days") {
      const date = addDays(START, target.toNumber() - 1);
      if (date <= today)
        add(
          date + "T03:00:00.000Z",
          def.target,
          `${def.target} dias corridos de desafio.\n${days.filter((d) => d <= date).length} dias com compra registrada até essa data.`,
        );
    } else if (def.metric === "purchase_days") {
      const day = days[target.toNumber() - 1];
      if (day) {
        const p = ps.find((p) => localDay(p.purchased_at) === day)!;
        add(
          p.purchased_at,
          def.target,
          `${def.target} dias com compra registrada.\nDia ${dayNumber(day)} do desafio.`,
        );
      }
    } else if (def.metric === "streak") {
      let streak = 0,
        previous = "";
      for (const day of days) {
        streak = previous && addDays(previous, 1) === day ? streak + 1 : 1;
        previous = day;
        if (streak >= target.toNumber()) {
          add(
            ps.find((p) => localDay(p.purchased_at) === day)!.purchased_at,
            String(streak),
            `${streak} dias consecutivos com compra registrada.\nDia ${dayNumber(day)} do desafio.`,
          );
          break;
        }
      }
    } else if (["contributions", "sats"].includes(def.metric)) {
      let accumulated = new Decimal(0);
      for (const p of ps) {
        accumulated = accumulated.add(
          def.metric === "sats"
            ? p.gross_sats - p.fee_sats
            : new Decimal(p.contribution_cents).div(100),
        );
        if (accumulated.gte(target)) {
          add(
            p.purchased_at,
            accumulated.toString(),
            def.metric === "sats"
              ? `${accumulated.toFixed(0)} satoshis líquidos acumulados.\n${btc(accumulated.toNumber())} BTC.`
              : `${brl(accumulated)} aportados desde o início.\nAportes representam dinheiro investido, sem incluir valorização.`,
          );
          break;
        }
      }
    } else if (def.metric === "wallet" || def.metric === "recovery") {
      let negative = false;
      for (const q of qs) {
        const included = ps.filter((p) => p.purchased_at <= q.captured_at);
        if (!included.length) continue;
        const t = totals(included, q.price);
        if (new Decimal(t.result).lt(0)) negative = true;
        const reached =
          def.metric === "wallet"
            ? new Decimal(t.value).gte(target)
            : negative && new Decimal(t.result).gte(0);
        if (reached) {
          add(
            q.captured_at,
            def.metric === "wallet" ? t.value : t.result,
            `Carteira estimada: ${brl(t.value)}.\nAportes: ${brl(t.contributed)}.\nResultado acumulado: ${brl(t.result)}.\nCotação salva: ${brl(q.price)}/BTC.`,
            q,
          );
          break;
        }
      }
    } else if (def.metric === "complete_month") {
      for (const month of [...new Set(days.map((d) => d.slice(0, 7)))]) {
        const end = monthLast(month);
        if (end >= today || month + "-01" < START) continue;
        if (daysBetween(month + "-01", end).every((d) => days.includes(d))) {
          add(
            end + "T23:59:00-03:00",
            "1",
            `Todas as datas de ${month} têm compra cadastrada.\n${daysBetween(month + "-01", end).length} dias com compra.`,
          );
          break;
        }
      }
    } else if (def.metric === "positive_month") {
      for (const q of qs.filter(
        (q) => q.kind === "close" && q.day === monthLast(q.day.slice(0, 7)),
      )) {
        const start = q.day.slice(0, 7) + "-01",
          prev = qs.find(
            (v) => v.kind === "close" && v.day === addDays(start, -1),
          );
        if (start < START || !prev) continue;
        const before = ps.filter((p) => p.purchased_at <= prev.captured_at),
          included = ps.filter((p) => p.purchased_at <= q.captured_at);
        if (
          ps.some(
            (p) =>
              localDay(p.purchased_at) < start &&
              p.purchased_at > prev.captured_at &&
              p.purchased_at <= q.captured_at,
          )
        )
          continue;
        const a = totals(before, prev.price),
          b = totals(included, q.price),
          result = new Decimal(b.value)
            .sub(a.value)
            .sub(new Decimal(b.contributed).sub(a.contributed));
        if (result.gt(0)) {
          add(
            q.captured_at,
            result.toString(),
            `Resultado de ${q.day.slice(0, 7)}: ${brl(result)}.\nVariação da carteira descontando novos aportes.`,
            q,
          );
          break;
        }
      }
    } else if (def.metric === "fee_record") {
      let best = new Decimal(-1);
      for (const p of ps) {
        if (!p.contribution_cents) continue;
        const rate = new Decimal(p.fee_sats)
          .mul(p.price)
          .div(1e8)
          .div(new Decimal(p.contribution_cents).div(100))
          .mul(100);
        if (rate.gt(best)) {
          if (best.gte(0))
            add(
              p.purchased_at,
              rate.toString(),
              `Maior taxa proporcional até esta compra: ${rate.toFixed(4)}% do aporte.\nTaxa convertida ao preço de execução; não representa spread.`,
              null,
              ":" + p.id,
            );
          best = rate;
        }
      }
    } else if (def.metric === "best_week") {
      let best: Decimal | null = null;
      for (const q of qs.filter(
        (q) =>
          q.kind === "close" &&
          new Date(q.day + "T12:00:00Z").getUTCDay() === 5,
      )) {
        const prev = qs.find(
          (v) => v.kind === "close" && v.day === addDays(q.day, -7),
        );
        if (!prev) continue;
        const included = ps.filter((p) => p.purchased_at <= q.captured_at),
          before = ps.filter((p) => p.purchased_at <= prev.captured_at);
        if (
          !before.length ||
          ps.some(
            (p) =>
              localDay(p.purchased_at) <= prev.day &&
              p.purchased_at > prev.captured_at &&
              p.purchased_at <= q.captured_at,
          )
        )
          continue;
        const a = totals(before, prev.price),
          b = totals(included, q.price),
          result = new Decimal(b.value)
            .sub(a.value)
            .sub(new Decimal(b.contributed).sub(a.contributed));
        if (best !== null && result.gt(best))
          add(
            q.captured_at,
            result.toString(),
            `Novo maior resultado semanal em reais: ${brl(result)}.\nSemana encerrada em ${q.day}, descontando os aportes.`,
            q,
            ":" + q.day,
          );
        if (best === null || result.gt(best)) best = result;
      }
    }
  }
  return output;
}
