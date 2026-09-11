import { z } from "zod";
import { addDays, localDay } from "./domain";
import {
  normalizeUrl,
  type CalendarItem,
  type EditorialSnapshot,
} from "./editorial-domain";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Data inválida",
  );
const text = (max: number) => z.string().trim().min(1).max(max);
const source = z
  .object({
    name: text(100),
    title: text(180),
    url: z
      .string()
      .max(1000)
      .transform((s, ctx) => {
        try {
          return normalizeUrl(s);
        } catch {
          ctx.addIssue({ code: "custom", message: "URL de fonte inválida" });
          return z.NEVER;
        }
      }),
    publishedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const radarPackageSchema = z
  .object({
    format: z.literal("dezembitcoin.radar"),
    version: z.literal(1),
    weekStart: day,
    weekEnd: day,
    researchedAt: z.string().datetime({ offset: true }),
    selectionNote: z.string().trim().max(1000),
    stories: z
      .array(
        z
          .object({
            title: text(140),
            eventDate: day,
            summary: text(700),
            context: text(700),
            commentary: text(700),
            classification: z.enum(["analise", "inferencia"]),
            sources: z.array(source).min(1).max(3),
            pages: z
              .array(
                z
                  .object({
                    title: text(100),
                    body: text(600),
                    label: z.enum([
                      "CAPA",
                      "NOTÍCIA",
                      "CONTEXTO",
                      "EXEMPLO",
                      "ANÁLISE",
                      "INFERÊNCIA",
                      "FONTES",
                    ]),
                    sourceIndexes: z
                      .array(z.number().int().min(0).max(2))
                      .min(1)
                      .max(3),
                  })
                  .strict(),
              )
              .min(4)
              .max(8),
            captions: z
              .object({
                instagram: text(2200),
                threads: text(500),
                tiktok: text(2200),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      !day.safeParse(p.weekStart).success ||
      !day.safeParse(p.weekEnd).success ||
      !Number.isFinite(Date.parse(p.researchedAt))
    )
      return;
    if (
      new Date(p.weekStart + "T12:00:00Z").getUTCDay() !== 1 ||
      addDays(p.weekStart, 4) !== p.weekEnd
    )
      fail("O período deve ir de segunda a sexta da mesma semana.");
    if (localDay(p.researchedAt) !== p.weekEnd)
      fail("A pesquisa deve registrar o corte da sexta-feira informada.");
    if (Date.parse(p.researchedAt) > Date.now() + 300000)
      fail("A pesquisa não pode estar no futuro.");
    if (p.stories.length < 4 && !p.selectionNote)
      fail("Explique por que foram selecionadas menos de quatro notícias.");
    const urls = new Set<string>();
    for (const s of p.stories) {
      if (!s.sources.length || !s.pages.length) continue;
      if (s.eventDate < p.weekStart || s.eventDate > p.weekEnd)
        fail("A data do acontecimento deve estar dentro da semana.");
      if (urls.has(s.sources[0].url))
        fail("Há notícias repetidas pela fonte principal.");
      urls.add(s.sources[0].url);
      if (
        s.sources.some(
          (source) =>
            Date.parse(source.publishedAt) > Date.parse(p.researchedAt),
        )
      )
        fail("A fonte não pode ser posterior ao corte da pesquisa.");
      if (
        s.pages[0].label !== "CAPA" ||
        !s.pages.some((page) => page.label === "NOTÍCIA") ||
        !s.pages.some((page) => ["ANÁLISE", "INFERÊNCIA"].includes(page.label))
      )
        fail(
          "Cada carrossel precisa de capa, notícia e análise ou inferência identificadas.",
        );
      if (
        s.pages.some(
          (page) =>
            page.sourceIndexes.some((index) => index >= s.sources.length) ||
            new Set(page.sourceIndexes).size !== page.sourceIndexes.length,
        )
      )
        fail("Índice de fonte inválido ou repetido em uma página.");
    }
  });
export type RadarPackage = z.infer<typeof radarPackageSchema>;
export function parseRadarPackage(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 60000)
    throw new Error("Arquivo do Radar excede 60 KB. Reduza os textos.");
  return radarPackageSchema.parse(value);
}
export function radarSnapshot(
  p: RadarPackage,
  story: RadarPackage["stories"][number],
  item: CalendarItem,
): EditorialSnapshot {
  return {
    templateVersion: 1,
    title: story.title,
    kind: "radar",
    start: p.weekStart,
    end: p.weekEnd,
    generatedAt: new Date().toISOString(),
    sourceItem: item,
    financial: null,
    pages: story.pages.map((page) => ({
      title: page.title,
      body: page.body,
      label: page.label,
      source: page.sourceIndexes
        .map(
          (index) =>
            `${story.sources[index].name} · ${story.sources[index].publishedAt.slice(0, 10)}`,
        )
        .join("\n"),
    })),
    captions: {
      ...story.captions,
      youtubeTitle: story.title.slice(0, 100),
      youtube: story.captions.tiktok,
    },
    prompt: JSON.stringify({
      instruction:
        "Preserve textos, ordem e fontes. Preto, laranja e branco; sem pessoas.",
      pages: story.pages,
      sources: story.sources,
    }),
    news: [
      {
        id: item.id + "-news",
        item_id: item.id,
        url: story.sources[0].url,
        source: story.sources[0].name,
        title: story.title,
        published_at: story.sources[0].publishedAt,
        event_date: story.eventDate,
        summary: story.summary,
        context: story.context,
        impact: story.commentary,
        classification: story.classification,
        selected: 1,
        reviewed: 0,
      },
    ],
    warnings: [
      "Pesquisa importada: confira fontes e todas as páginas antes de confirmar a revisão.",
    ],
    research: {
      weekStart: p.weekStart,
      weekEnd: p.weekEnd,
      researchedAt: p.researchedAt,
      selectionNote: p.selectionNote,
      story,
    },
  };
}
