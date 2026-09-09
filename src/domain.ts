import Decimal from "decimal.js";
import { z } from "zod";
export const START = "2026-09-09";
export const brl = (v: Decimal.Value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(v))
    .replace(/\u00a0/g, " ");
export const btc = (sats: number) =>
  new Decimal(sats).div(1e8).toFixed(8).replace(".", ",");
export const pct = (v: string) =>
  `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2).replace(".", ",")}%`;
export const localDay = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
export const localTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
export const dayNumber = (day: string) =>
  Math.floor(
    (Date.parse(day + "T00:00:00Z") - Date.parse(START + "T00:00:00Z")) /
      86400000,
  ) + 1;
export const addDays = (day: string, count: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + count * 86400000)
    .toISOString()
    .slice(0, 10);
export function daysBetween(start: string, end: string) {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
const decimal = z
  .string()
  .max(30)
  .transform((v, ctx) => {
    if (
      !/^\d+(\.\d+)?$/.test(v) ||
      !new Decimal(v).isFinite() ||
      new Decimal(v).gt(1e12)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Valor decimal inválido ou fora do limite",
      });
      return z.NEVER;
    }
    return v;
  });
export const purchaseSchema = z
  .object({
    operation_id: z.string().trim().max(100).default(""),
    purchased_at: z.iso.datetime({ offset: true }),
    quantity: decimal.refine(
      (v) =>
        new Decimal(v).gt(0) &&
        new Decimal(v).mul(1e8).isInteger() &&
        new Decimal(v).lte(21000000),
      "BTC deve ter até 8 casas",
    ),
    fee: decimal.refine(
      (v) => new Decimal(v).mul(1e8).isInteger(),
      "Taxa deve ter até 8 casas",
    ),
    price: decimal.refine(
      (v) => new Decimal(v).gt(0),
      "Preço deve ser positivo",
    ),
    total: decimal.refine(
      (v) => new Decimal(v).mul(100).isInteger(),
      "Use centavos",
    ),
    contribution: decimal.refine(
      (v) => new Decimal(v).gt(0) && new Decimal(v).mul(100).isInteger(),
      "Aporte deve ser positivo em centavos",
    ),
    note: z.string().max(2000).default(""),
  })
  .superRefine((v, c) => {
    if (new Decimal(v.fee).gte(v.quantity))
      c.addIssue({
        code: "custom",
        message: "Taxa deve ser menor que a quantidade",
      });
    if (
      localDay(v.purchased_at) < START ||
      new Date(v.purchased_at).getTime() > Date.now() + 60000
    )
      c.addIssue({
        code: "custom",
        message: "Data fora do período do desafio ou no futuro",
      });
  });
export interface Purchase {
  id: string;
  operation_id: string | null;
  purchased_at: string;
  gross_sats: number;
  fee_sats: number;
  price: string;
  total_cents: number;
  contribution_cents: number;
  note: string;
  created_at: string;
  updated_at: string;
}
export interface Quote {
  id: string;
  day: string;
  kind: "midday" | "close" | "manual";
  price: string;
  captured_at: string;
  source_timestamp: string;
  source: string;
  raw_json: string;
}
export interface Snapshot {
  version: 1;
  type: "daily" | "weekly" | "monthly";
  start: string;
  end: string;
  asOf: string;
  title: string;
  quote: Quote;
  sats: number;
  contributed: string;
  value: string;
  result: string;
  percent: string;
  periodContribution: string;
  periodSats: number;
  periodFees: string;
  periodResult: string | null;
  buys: number;
  missingDays: string[];
  warnings: string[];
  purchases: Purchase[];
  series: { day: string; value: string; contributed: string }[];
  captions: {
    instagram: string;
    threads: string;
    youtubeTitle: string;
    youtube: string;
  };
}
export function totals(rows: Purchase[], price: string) {
  const sats = rows.reduce((s, p) => s + p.gross_sats - p.fee_sats, 0);
  const contributed = new Decimal(
    rows.reduce((s, p) => s + p.contribution_cents, 0),
  ).div(100);
  const value = new Decimal(sats).div(1e8).mul(price),
    result = value.sub(contributed);
  return {
    sats,
    contributed: contributed.toString(),
    value: value.toString(),
    result: result.toString(),
    percent: contributed.gt(0)
      ? result.div(contributed).mul(100).toString()
      : "0",
  };
}
export function makeSnapshot(
  all: Purchase[],
  quotes: Quote[],
  type: Snapshot["type"],
  start: string,
  end: string,
  quoteId: string,
): Snapshot {
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote || quote.day !== end)
    throw new Error("Escolha uma cotação coletada na data final do conteúdo.");
  const cutoff = quote.captured_at;
  const included = all.filter(
    (p) => p.purchased_at <= cutoff && localDay(p.purchased_at) <= end,
  );
  const period = included.filter((p) => localDay(p.purchased_at) >= start);
  if (!included.length)
    throw new Error(
      "Não há compras nesse período antes da cotação selecionada.",
    );
  const total = totals(included, quote.price);
  const before = included.filter((p) => localDay(p.purchased_at) < start);
  const previous = quotes
    .filter((q) => q.day === addDays(start, -1) && q.kind === "close")
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
  const periodContribution = new Decimal(
    period.reduce((s, p) => s + p.contribution_cents, 0),
  ).div(100);
  const periodResult = before.length
    ? previous && !before.some((p) => p.purchased_at > previous.captured_at)
      ? new Decimal(total.value)
          .sub(totals(before, previous.price).value)
          .sub(periodContribution)
          .toString()
      : null
    : new Decimal(total.value).sub(periodContribution).toString();
  const missingDays = daysBetween(start, end).filter(
    (d) => !included.some((p) => localDay(p.purchased_at) === d),
  );
  const warnings: string[] = [];
  if (quote.kind !== "close")
    warnings.push("Posição no horário da cotação; não é fechamento diário.");
  if (
    all.some((p) => localDay(p.purchased_at) <= end && p.purchased_at > cutoff)
  )
    warnings.push(
      "Há compras posteriores ao corte que não entram neste conteúdo.",
    );
  if (periodResult === null)
    warnings.push(
      "Sem fechamento inicial válido para todas as compras anteriores: resultado do período indisponível.",
    );
  if (missingDays.length)
    warnings.push(
      `${missingDays.length} dia(s) sem compra cadastrada até o corte.`,
    );
  const series = quotes
    .filter(
      (q) =>
        q.kind === "close" &&
        q.day >= start &&
        q.day <= end &&
        q.captured_at <= cutoff,
    )
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((q) => ({
      day: q.day,
      ...totals(
        all.filter((p) => p.purchased_at <= q.captured_at),
        q.price,
      ),
    }));
  const title =
    type === "daily"
      ? `DIA #${String(dayNumber(end)).padStart(3, "0")}`
      : type === "weekly"
        ? "RESUMO SEMANAL"
        : addDays(end, 1).slice(0, 7) !== end.slice(0, 7) &&
            quote.kind === "close"
          ? "FECHAMENTO MENSAL"
          : "RESUMO MENSAL";
  const s: Snapshot = {
    version: 1,
    type,
    start,
    end,
    asOf: cutoff,
    title,
    quote,
    ...total,
    periodContribution: periodContribution.toString(),
    periodSats: period.reduce((n, p) => n + p.gross_sats - p.fee_sats, 0),
    periodFees: period
      .reduce(
        (n, p) => n.add(new Decimal(p.fee_sats).div(1e8).mul(p.price)),
        new Decimal(0),
      )
      .toString(),
    periodResult,
    buys: period.length,
    missingDays,
    warnings,
    purchases: period,
    series,
    captions: { instagram: "", threads: "", youtubeTitle: "", youtube: "" },
  };
  s.captions = makeCaptions(s);
  return s;
}
export function makeCaptions(s: Snapshot) {
  const sign = Number(s.result) > 0 ? "+" : "";
  const dates =
    s.start === s.end
      ? s.end.split("-").reverse().join("/")
      : s.start.split("-").reverse().join("/") +
        " a " +
        s.end.split("-").reverse().join("/");
  const core = `${s.title} · ${dates}\n\nAportes ${s.type === "daily" ? "do dia" : "do período"}: ${brl(s.periodContribution)}\nTotal aportado: ${brl(s.contributed)}\nBTC acumulado: ${btc(s.sats)}\nCarteira: ${brl(s.value)}\nResultado acumulado: ${sign}${brl(s.result)} (${pct(s.percent)})`;
  const reference = `Posição em ${localTime(s.asOf)} (Brasília). Cotação Bitpreço / último negócio. Valor estimado antes de custos de venda.`;
  const note = s.warnings.length
    ? "\n\nObservações: " + s.warnings.join(" ")
    : "";
  return {
    instagram: `${core}\n\nMais um registro da jornada de R$ 10 por dia em Bitcoin. A meta é uma carteira de R$ 1 milhão, sem prazo ou retorno garantido.\n\nAcompanhe os números, inclusive as quedas. Dez por dia, rumo ao milhão.\n\n${reference}${note}\n\n#DezEmBitcoin #Bitcoin #DiarioDeInvestimentos`,
    threads: `${core}\n\nDez por dia, rumo ao milhão. Acompanhe a jornada!\n${localTime(s.asOf)} (Brasília). Valor estimado.${s.warnings.length ? "\nConfira as observações na arte." : ""}`,
    youtubeTitle: `${s.title}: ${brl(s.contributed)} aportados em Bitcoin`,
    youtube: `${core}\n\nR$ 10 em Bitcoin por dia, com transparência sobre taxas, altas e quedas. Inscreva-se para acompanhar. Meta sem prazo ou retorno garantido.\n\n${reference}${note}\n\n#DezEmBitcoin #Bitcoin #Shorts`,
  };
}
