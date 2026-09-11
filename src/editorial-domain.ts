import Decimal from "decimal.js";
import {
  START,
  addDays,
  daysBetween,
  dayNumber,
  localDay,
  localTime,
  brl,
  btc,
  totals,
  makeSnapshot,
  type Purchase,
  type Quote,
  type Snapshot,
} from "./domain";
export const CHANNELS = ["instagram", "threads", "tiktok", "youtube"] as const;
export const WEEK = [
  "reflection",
  "difficulty",
  "education",
  "fees",
  "comparison",
  "radar",
  "weekly",
] as const;
export const LABELS: Record<string, string> = {
  daily: "Compra diária",
  difficulty: "Dificuldade da semana",
  education: "Educação Bitcoin",
  fees: "Taxa sem esconder",
  comparison: "Quanto R$ 10 compraram?",
  radar: "Radar Cripto da Semana",
  weekly: "Resumo semanal",
  reflection: "Reflexão visual",
  monthly: "Fechamento mensal",
  month_compare: "Mês a mês",
  month_ranking: "Ranking das compras do mês",
  month_average: "Preço médio do mês",
  month_chart: "Evolução do mês",
  month_learning: "Aprendizados do mês",
  month_difficulty: "Dificuldade do mês",
  month_balance: "Balanço e próximo foco",
  month_fees: "Taxas do mês",
  milestone: "Marco do desafio",
};
export const SUBJECTIVE = [
  "difficulty",
  "reflection",
  "month_learning",
  "month_difficulty",
  "month_balance",
];
export const EDUCATION = [
  [
    "O que é um satoshi?",
    "Um Bitcoin pode ser dividido em 100 milhões de satoshis.",
    "2.467 satoshis equivalem a 0,00002467 BTC. Esse é um exemplo de unidade, não de cotação.",
  ],
  [
    "Como funciona a compra periódica?",
    "Investir um valor fixo em intervalos regulares distribui as compras entre preços diferentes.",
    "Com R$ 10, uma cotação menor compra mais BTC. A estratégia não garante lucro nem elimina perdas.",
  ],
  [
    "Aporte não é rendimento",
    "Aporte é o dinheiro colocado. Resultado é a diferença entre o valor da carteira e o custo acumulado.",
    "Uma carteira crescer de R$ 100 para R$ 110 depois de um aporte de R$ 10 não significa lucro de R$ 10.",
  ],
  [
    "Taxa em Bitcoin, custo em reais",
    "A taxa descontada em BTC reduz a quantidade que fica no saldo.",
    "Para estimar a taxa em reais na compra, multiplicamos a taxa em BTC pelo preço de execução.",
  ],
  [
    "Preço médio das compras",
    "A média precisa considerar a quantidade de BTC de cada execução.",
    "O custo por BTC líquido, incluindo taxas, é o total aportado dividido pelo BTC líquido acumulado.",
  ],
  [
    "O que é volatilidade?",
    "É a oscilação dos preços ao longo do tempo.",
    "O valor da carteira pode mudar mesmo em um dia sem compras. Uma alta recente não garante a próxima.",
  ],
  [
    "Cotação não é preço garantido",
    "A cotação do último negócio descreve uma negociação que já aconteceu.",
    "O preço disponível para sua ordem pode ser diferente, e uma venda pode ter custos.",
  ],
  [
    "BTC bruto e BTC líquido",
    "A quantidade bruta vem antes da taxa. A líquida é o saldo após o desconto.",
    "Descontar a taxa novamente do saldo líquido contaria o mesmo custo duas vezes.",
  ],
  [
    "Custódia: quem controla as chaves?",
    "A custódia define quem guarda as chaves que autorizam transações.",
    "Guardar por conta própria e usar um custodiante têm responsabilidades diferentes. Nunca divulgue uma frase de recuperação.",
  ],
  [
    "Lucro não realizado",
    "É o resultado estimado de uma posição que ainda não foi vendida.",
    "O resultado pode mudar com a cotação e com custos de uma eventual venda.",
  ],
  [
    "Comparar compras de valores diferentes",
    "Comparar somente o BTC recebido pode confundir o efeito do preço com o tamanho do aporte.",
    "Normalizamos em satoshis por R$ 10 efetivamente gastos, considerando a taxa.",
  ],
  [
    "Dia corrido e sequência de compras",
    "O dia do desafio conta o calendário. A sequência conta dias consecutivos com compra.",
    "Uma falha na sequência não apaga os aportes anteriores. São medidas diferentes.",
  ],
];
export interface CalendarItem {
  id: string;
  origin_key: string;
  planned_date: string;
  deadline: string;
  kind: string;
  title: string;
  period_start: string;
  period_end: string;
  note: string;
  lifecycle: string;
  cancel_reason: string;
  extra: number;
  channels_json: string;
  current_version: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  state?: string;
  pending?: string[];
}
export interface Publication {
  item_id: string;
  channel: string;
  version_id: string;
  published_at: string;
  url: string;
  note: string;
}
export interface News {
  id: string;
  item_id: string;
  url: string;
  title: string;
  source: string;
  published_at: string;
  event_date: string;
  summary: string;
  context: string;
  impact: string;
  classification: string;
  selected: number;
  reviewed: number;
}
export interface Slide {
  title: string;
  body: string;
  label: string;
  source?: string;
  chart?: { label: string; value: number; cost: number }[];
  chartMode?: "average";
}
export interface EditorialSnapshot {
  research?: {
    weekStart: string;
    weekEnd: string;
    researchedAt: string;
    selectionNote: string;
    story: import("./radar-import").RadarPackage["stories"][number];
  };
  templateVersion: 1;
  title: string;
  kind: string;
  start: string;
  end: string;
  generatedAt: string;
  sourceItem: CalendarItem;
  financial: Snapshot | null;
  pages: Slide[];
  captions: {
    tiktok?: string;
    instagram: string;
    threads: string;
    youtubeTitle: string;
    youtube: string;
  };
  prompt: string;
  news: News[];
  warnings: string[];
}
export const monthLast = (month: string) =>
  addDays(
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
      .toISOString()
      .slice(0, 10),
    -1,
  );
export const monthShift = (month: string, delta: number) =>
  new Date(
    Date.UTC(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)) - 1 + delta,
      1,
    ),
  )
    .toISOString()
    .slice(0, 7);
export function planMonth(month: string, monthlyDay = 1) {
  const items: {
    key: string;
    date: string;
    kind: string;
    title: string;
    start: string;
    end: string;
  }[] = [];
  for (const date of daysBetween(month + "-01", monthLast(month))) {
    if (date < START) continue;
    const dow = new Date(date + "T12:00:00Z").getUTCDay(),
      kind = WEEK[dow];
    const edu =
      EDUCATION[Math.floor((dayNumber(date) - 1) / 7) % EDUCATION.length][0];
    items.push({
      key: `daily:${date}`,
      date,
      kind: "daily",
      title: `Compra diária · dia ${dayNumber(date)}`,
      start: date,
      end: date,
    });
    const end = kind === "radar" || date === START ? date : addDays(date, -1),
      start = [START, addDays(end, -6)].sort().at(-1)!;
    items.push({
      key: `weekly:${date}`,
      date,
      kind,
      title: kind === "education" ? edu : LABELS[kind],
      start: start > end ? end : start,
      end,
    });
  }
  const previous = monthShift(month, -1);
  if (monthLast(previous) >= START) {
    const kinds = [
      "monthly",
      "month_compare",
      "month_ranking",
      "month_average",
      "month_chart",
      "month_learning",
      "month_difficulty",
      "month_balance",
      "month_fees",
    ];
    kinds.forEach((kind, index) => {
      const date = addDays(
        month + "-01",
        Math.min(
          monthlyDay - 1 + index,
          Number(monthLast(month).slice(-2)) - 1,
        ),
      );
      items.push({
        key: `monthly:${previous}:${kind}`,
        date,
        kind,
        title: `${LABELS[kind]} · ${previous}`,
        start: [START, previous + "-01"].sort().at(-1)!,
        end: monthLast(previous),
      });
    });
  }
  return items;
}
export function selectedQuote(item: CalendarItem, quotes: Quote[]) {
  return quotes
    .filter(
      (q) =>
        q.day === item.period_end &&
        (!(item.kind === "monthly" || item.kind.startsWith("month_")) ||
          q.kind === "close"),
    )
    .sort(
      (a, b) =>
        Number(b.kind === "close") - Number(a.kind === "close") ||
        b.captured_at.localeCompare(a.captured_at),
    )[0];
}
export function readiness(
  item: CalendarItem,
  purchases: Purchase[],
  quotes: Quote[],
  news: News[],
  today: string,
) {
  const missing: string[] = [];
  if (item.period_end > today && item.kind !== "education")
    missing.push("Período ainda não terminou.");
  if (SUBJECTIVE.includes(item.kind) && !item.note.trim())
    missing.push("Registre sua observação pessoal para este conteúdo.");
  if (item.kind === "radar") {
    const selected = news.filter((n) => n.item_id === item.id && n.selected);
    if (!selected.length)
      missing.push("Selecione até cinco notícias e confira as fontes.");
    if (selected.length > 5)
      missing.push("Selecione no máximo cinco notícias.");
    if (
      selected.some(
        (n) =>
          !n.reviewed ||
          !n.summary.trim() ||
          !n.context.trim() ||
          !n.impact.trim(),
      )
    )
      missing.push(
        "Revise resumo, contexto e comentário das notícias selecionadas.",
      );
  } else if (!["education", "milestone"].includes(item.kind)) {
    if (
      item.kind === "daily" &&
      !purchases.some((p) => localDay(p.purchased_at) === item.period_end)
    )
      missing.push("Falta registrar a compra deste dia.");
    const q = selectedQuote(item, quotes);
    if (
      item.kind === "daily" &&
      q &&
      !purchases.some(
        (p) =>
          localDay(p.purchased_at) === item.period_end &&
          p.purchased_at <= q.captured_at,
      )
    )
      missing.push("Falta uma cotação após a compra deste dia.");
    if (!q)
      missing.push(
        "Falta cotação na data final (fechamento obrigatório para conteúdo mensal).",
      );
    if (
      !purchases.some(
        (p) =>
          localDay(p.purchased_at) <= item.period_end &&
          (!q || p.purchased_at <= q.captured_at),
      )
    )
      missing.push("Falta compra no histórico até o corte.");
  }
  return missing;
}
export function itemState(
  item: CalendarItem,
  publications: Publication[],
  reviewed: boolean,
  missing: string[],
) {
  if (item.lifecycle === "cancelled") return "cancelado";
  if (item.lifecycle === "paused") return "pausado";
  const channels = JSON.parse(item.channels_json) as string[];
  const count = channels.filter((c) =>
    publications.some((p) => p.item_id === item.id && p.channel === c),
  ).length;
  if (count === channels.length && count > 0) return "publicado";
  if (count > 0) return "publicado_parcialmente";
  if (item.current_version) return reviewed ? "revisado" : "gerado";
  return missing.length ? "dados_pendentes" : "pronto_para_gerar";
}
export function normalizeUrl(value: string) {
  const u = new URL(value);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
    throw new Error("URL inválida.");
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (key.startsWith("utm_")) u.searchParams.delete(key);
  return u.href;
}
export function buildEditorial(
  item: CalendarItem,
  purchases: Purchase[],
  quotes: Quote[],
  news: News[],
  today: string,
  milestone?: { description: string; achievedAt: string },
): EditorialSnapshot {
  news = news.filter((n) => n.item_id === item.id);
  const pending = readiness(item, purchases, quotes, news, today);
  if (pending.length) throw new Error(pending.join(" "));
  const q = selectedQuote(item, quotes);
  let financial: Snapshot | null = null;
  if (!["radar", "education", "milestone"].includes(item.kind))
    financial = makeSnapshot(
      purchases,
      quotes,
      item.kind === "daily"
        ? "daily"
        : item.kind === "monthly" || item.kind.startsWith("month_")
          ? "monthly"
          : "weekly",
      item.period_start,
      item.period_end,
      q!.id,
    );
  const pages: Slide[] = [
    {
      title: item.title,
      body: `${item.period_start.split("-").reverse().join("/")} a ${item.period_end.split("-").reverse().join("/")}\nDez por dia, rumo ao milhão.`,
      label: "DEZ EM BITCOIN",
    },
  ];
  const warnings = financial?.warnings ?? [];
  const partialMonth =
    (item.kind === "monthly" || item.kind.startsWith("month_")) &&
    !item.period_start.endsWith("-01");
  if (partialMonth) {
    warnings.push(
      `Mês inicial parcial: dados desde ${item.period_start.split("-").reverse().join("/")}.`,
    );
    pages[0].title += " (período parcial)";
  }
  if (item.kind === "radar") {
    for (const n of news.filter((n) => n.item_id === item.id && n.selected)) {
      pages.push({
        title: n.title,
        body: n.summary,
        label: "NOTÍCIA",
        source: `${n.source} · ${n.published_at.slice(0, 10)}\n${n.url}`,
      });
      pages.push({
        title: "Contexto e comentário",
        body: `${n.context}\n\n${n.impact}`,
        label: n.classification === "inferencia" ? "INFERÊNCIA" : "ANÁLISE",
        source: n.url,
      });
    }
    pages.push({
      title: "Notícia não é previsão",
      body: "Fatos ajudam a entender o mercado. Não determinam a próxima cotação nem o resultado da carteira.",
      label: "LEITURA DA SEMANA",
    });
  } else if (item.kind === "education") {
    const topic =
      EDUCATION.find((e) => e[0] === item.title) ??
      EDUCATION[
        Math.floor(Math.max(0, dayNumber(item.planned_date) - 1) / 7) %
          EDUCATION.length
      ];
    pages.push(
      { title: topic[0], body: topic[1], label: "CONCEITO" },
      { title: "Um exemplo para entender", body: topic[2], label: "EXEMPLO" },
      {
        title: "Aprendizado da semana",
        body:
          item.note ||
          "Entender os números faz parte de acompanhar a jornada. Nenhuma estratégia garante retorno.",
        label: "PARA LEMBRAR",
      },
    );
  } else if (item.kind === "milestone") {
    if (!milestone) throw new Error("Marco não encontrado.");
    pages.push(
      {
        title: "Um marco registrado",
        body: milestone.description,
        label: "DADOS DO MARCO",
      },
      {
        title: "Mais um passo na jornada",
        body: `Registrado em ${localTime(milestone.achievedAt)} (Brasília).\n${item.note || "Uma conquista do histórico. Os valores da carteira continuam sujeitos a oscilações."}`,
        label: "CONSTÂNCIA",
      },
    );
  } else if (financial) {
    const f = financial,
      rows = f.purchases;
    const fees = new Decimal(f.periodFees),
      cost = new Decimal(f.periodContribution),
      gross = rows.reduce((n, p) => n + p.gross_sats, 0),
      feeSats = rows.reduce((n, p) => n + p.fee_sats, 0);
    const grouped = new Map<string, { sats: number; cents: number }>();
    for (const p of rows) {
      const day = localDay(p.purchased_at),
        entry = grouped.get(day) ?? { sats: 0, cents: 0 };
      entry.sats += p.gross_sats - p.fee_sats;
      entry.cents += p.contribution_cents;
      grouped.set(day, entry);
    }
    const ranking = [...grouped]
      .filter(([, v]) => v.cents > 0)
      .map(([day, v]) => ({
        date: day.split("-").reverse().join("/"),
        sats: new Decimal(v.sats).mul(1000).div(v.cents).toNumber(),
      }))
      .sort((a, b) => b.sats - a.sats);
    const averages = [
      {
        title: "Custo por BTC líquido",
        body: f.sats
          ? `${brl(new Decimal(f.contributed).div(new Decimal(f.sats).div(1e8)))}/BTC\nAportes acumulados divididos pelo BTC líquido, incluindo taxas.`
          : "Sem saldo.",
        label: "MÉDIA ACUMULADA",
      },
      {
        title: "Média das execuções no período",
        body: gross
          ? `${brl(rows.reduce((s, p) => s.add(new Decimal(p.price).mul(p.gross_sats)), new Decimal(0)).div(gross))}/BTC\nPonderada pelo BTC bruto de cada compra.`
          : "Sem compras no período.",
        label: "MÉDIA DAS COMPRAS",
      },
    ];
    if (["fees", "month_fees"].includes(item.kind))
      pages.push(
        {
          title: "Quanto ficou no saldo?",
          body: `BTC bruto: ${btc(gross)}\nTaxas: ${btc(feeSats)} BTC\nBTC líquido: ${btc(f.periodSats)}`,
          label: "A CONTA ABERTA",
        },
        {
          title: "Taxa sem esconder",
          body: `Taxas no período: ≈ ${brl(fees)}\nProporção dos aportes: ${cost.gt(0) ? fees.div(cost).mul(100).toFixed(2).replace(".", ",") : "0,00"}%\nConversão ao preço de cada execução.`,
          label: "CUSTO EM REAIS",
        },
        {
          title: "Desde o início",
          body: `Taxas acumuladas: ≈ ${brl(purchases.filter((p) => p.purchased_at <= f.asOf).reduce((s, p) => s.add(new Decimal(p.fee_sats).mul(p.price).div(1e8)), new Decimal(0)))}\nEsses custos já estão incluídos no resultado da carteira.`,
          label: "SEM CONTAR DUAS VEZES",
        },
      );
    else if (["comparison", "month_ranking"].includes(item.kind))
      pages.push(
        {
          title: "Mais satoshis por R$ 10",
          body:
            ranking
              .slice(0, 3)
              .map((r, i) => `${i + 1}. ${r.date}: ${r.sats.toFixed(2)} sats`)
              .join("\n") || "Sem compras.",
          label: "COMPRAS NORMALIZADAS",
        },
        {
          title: "Menos satoshis por R$ 10",
          body:
            ranking
              .slice(-3)
              .reverse()
              .map((r, i) => `${i + 1}. ${r.date}: ${r.sats.toFixed(2)} sats`)
              .join("\n") || "Sem compras.",
          label: "MESMO VALOR PARA COMPARAR",
        },
        ...averages,
      );
    else if (item.kind === "month_average") {
      pages.push(...averages);
      const points = [...new Set(rows.map((p) => localDay(p.purchased_at)))]
        .sort()
        .map((day) => {
          const included = purchases.filter(
            (p) => localDay(p.purchased_at) <= day && p.purchased_at <= f.asOf,
          );
          const t = totals(included, "0");
          return {
            label: day,
            value: t.sats
              ? new Decimal(t.contributed)
                  .div(new Decimal(t.sats).div(1e8))
                  .toNumber()
              : 0,
            cost: 0,
          };
        });
      pages.push({
        title: "Como o custo médio evoluiu",
        body: "Custo acumulado por BTC líquido após as compras de cada data. Inclui taxas. Datas sem compra não acrescentam pontos.",
        label: "MÉDIA AO LONGO DO MÊS",
        chart: points,
        chartMode: "average",
      });
    } else if (SUBJECTIVE.includes(item.kind))
      pages.push(
        {
          title:
            item.kind === "reflection"
              ? "Uma pausa para olhar a jornada"
              : "O registro desta semana",
          body: item.note,
          label: "RELATO PESSOAL",
        },
        {
          title: "Os números por trás do relato",
          body: `Aportes: ${brl(f.periodContribution)}\nCompras registradas: ${f.buys}\nDias sem compra cadastrada: ${f.missingDays.length}`,
          label: "DADOS DO PERÍODO",
        },
      );
    else {
      pages.push(
        {
          title: "Cada aporte conta",
          body: `No período: ${brl(f.periodContribution)}\nDesde o início: ${brl(f.contributed)}\nCompras registradas: ${f.buys}`,
          label: "APORTES",
        },
        {
          title: "Bitcoin acumulado",
          body: `${btc(f.sats)} BTC\nRecebido no período: ${btc(f.periodSats)} BTC\nTaxas do período: ≈ ${brl(f.periodFees)}`,
          label: "QUANTIDADE E TAXAS",
        },
        {
          title: "Quanto vale a carteira?",
          body: `${brl(f.value)}\nResultado acumulado: ${brl(f.result)} (${Number(f.percent).toFixed(2).replace(".", ",")}%)\nResultado do período: ${f.periodResult === null ? "sem abertura válida" : brl(f.periodResult)}`,
          label: "RESULTADO",
        },
      );
    }
    if (
      ["monthly", "month_chart", "weekly", "month_compare"].includes(item.kind)
    ) {
      const missing = daysBetween(item.period_start, item.period_end).filter(
        (d) => !f.series.some((p) => p.day === d),
      );
      pages.push({
        title: "Aportes e carteira",
        body:
          f.series.length < 2
            ? "Ainda não há dois fechamentos para traçar a evolução."
            : `${missing.length} dia(s) sem fechamento no período. Só os pontos registrados são mostrados.`,
        label: "HISTÓRICO",
        chart: f.series.map((v) => ({
          label: v.day,
          value: Number(v.value),
          cost: Number(v.contributed),
        })),
      });
    }
    if (item.kind === "month_compare") {
      const prev = monthShift(item.period_start.slice(0, 7), -1),
        end = monthLast(prev),
        quote = quotes.find((v) => v.day === end && v.kind === "close");
      if (quote && purchases.some((p) => p.purchased_at <= quote.captured_at)) {
        const t = totals(
          purchases.filter((p) => p.purchased_at <= quote.captured_at),
          quote.price,
        );
        pages.push({
          title: "Mês anterior × mês atual",
          body: `Carteira anterior: ${brl(t.value)}\nCarteira atual: ${brl(f.value)}\nAportes deste período: ${brl(f.periodContribution)}\nCrescimento do saldo não equivale a rentabilidade.`,
          label: "COMPARAÇÃO MENSAL",
        });
      } else
        pages.push({
          title: "Primeiro mês de histórico",
          body: "Sem fechamento válido do mês anterior para comparar. Nenhum valor anterior foi estimado.",
          label: "DADO INDISPONÍVEL",
        });
    }
    pages.push({
      title: "Referência dos números",
      body: `${brl(f.quote.price)}/BTC\n${localTime(f.asOf)} (Brasília)\nValor estimado antes de custos de venda.${warnings.length ? "\n" + warnings.join(" ") : ""}`,
      label: "TRANSPARÊNCIA",
    });
  }
  if (item.kind === "daily" && financial)
    pages.splice(0, pages.length, {
      title: financial.title,
      label: "COMPRA DIÁRIA",
      body: `Aporte: ${brl(financial.periodContribution)}. BTC líquido comprado: ${btc(financial.periodSats)}. Total aportado: ${brl(financial.contributed)}. Carteira: ${brl(financial.value)}. Resultado: ${brl(financial.result)} (${Number(financial.percent).toFixed(2).replace(".", ",")}%). Cotação: ${brl(financial.quote.price)}/BTC em ${localTime(financial.asOf)}. ${warnings.join(" ")}`,
    });
  const summary = financial
    ? `Aportes no período: ${brl(financial.periodContribution)}. Carteira: ${brl(financial.value)}. Resultado acumulado: ${brl(financial.result)} (${Number(financial.percent).toFixed(2).replace(".", ",")}%).`
    : pages
        .slice(1, 3)
        .map((p) => p.title)
        .join(" · ");
  const sources =
    item.kind === "radar"
      ? "\n\nFontes:\n" +
        news
          .filter((n) => n.selected)
          .map((n) => n.url)
          .join("\n")
      : "";
  const captions = {
    tiktok: `${item.title}\n\n${summary}${sources}\n\n#DezEmBitcoin #Bitcoin`,
    instagram: `${item.title}\n\n${summary}${partialMonth ? "\nMês inicial parcial, desde " + item.period_start + "." : ""}\n\nDez por dia, rumo ao milhão.${financial ? "\nPosição em " + localTime(financial.asOf) + " (Brasília)." : ""}${sources}\n\n#DezEmBitcoin #Bitcoin`,
    threads:
      `${item.title}\n\n${summary}\n\nDez por dia, rumo ao milhão.`.slice(
        0,
        490,
      ),
    youtubeTitle: item.title.slice(0, 100),
    youtube: `${item.title}\n\n${summary}${sources}\n\n#DezEmBitcoin #Bitcoin #Shorts`,
  };
  const prompt = `Crie um carrossel para Dez em Bitcoin, preto, laranja e branco, 1080x1350. Preserve exatamente os números e fontes do JSON. Sem pessoas, bastidores do sistema, perguntas ao público ou experiências inventadas. Classifique fato, análise e inferência. Revise o texto em português. Dados: ${JSON.stringify({ title: item.title, pages })}`;
  return {
    templateVersion: 1,
    title: item.title,
    kind: item.kind,
    start: item.period_start,
    end: item.period_end,
    generatedAt: new Date().toISOString(),
    sourceItem: item,
    financial,
    pages,
    captions:
      item.kind === "daily" && financial
        ? { ...financial.captions, tiktok: financial.captions.instagram }
        : captions,
    prompt,
    news: news.filter((n) => n.selected),
    warnings,
  };
}
