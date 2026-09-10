import { XMLParser } from "fast-xml-parser";
import { localDay } from "./domain";
import { normalizeUrl, type CalendarItem } from "./editorial-domain";
export const NEWS_SOURCES = [
  { name: "Ethereum Foundation", url: "https://blog.ethereum.org/feed.xml" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
];
export async function collectNews(env: { DB: D1Database }, item: CalendarItem) {
  const reports: string[] = [];
  for (const source of NEWS_SOURCES) {
    try {
      const r = await fetch(source.url, {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (!r.ok) throw new Error("Fonte indisponível");
      const reader = r.body?.getReader();
      if (!reader) throw new Error("Resposta vazia");
      let bytes = 0,
        text = "";
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 2000000) {
          await reader.cancel();
          throw new Error("Feed muito grande");
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      if (/<!DOCTYPE|<!ENTITY/i.test(text))
        throw new Error("Feed incompatível");
      const parsed = new XMLParser({
        ignoreAttributes: false,
        processEntities: false,
      }).parse(text);
      const raw = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
      const entries = Array.isArray(raw) ? raw : [raw];
      let count = 0;
      for (const entry of entries.slice(0, 100)) {
        const time = Date.parse(
          entry.pubDate ?? entry.published ?? entry.updated,
        );
        if (!Number.isFinite(time) || time > Date.now()) continue;
        const published = new Date(time).toISOString(),
          day = localDay(published);
        if (day < item.period_start || day > item.period_end) continue;
        const link =
          typeof entry.link === "string" ? entry.link : entry.link?.["@_href"];
        if (!link) continue;
        const url = normalizeUrl(link),
          title = String(entry.title?.["#text"] ?? entry.title ?? "")
            .replace(/<[^>]*>/g, "")
            .slice(0, 240);
        if (!title) continue;
        await env.DB.prepare(
          "INSERT OR IGNORE INTO editorial_news(id,item_id,url,title,source,published_at) VALUES(?,?,?,?,?,?)",
        )
          .bind(
            crypto.randomUUID(),
            item.id,
            url,
            title,
            source.name,
            published,
          )
          .run();
        count++;
        if (count >= 8) break;
      }
      reports.push(`${source.name}: ${count} candidatos no período.`);
    } catch {
      reports.push(
        `${source.name}: falha na coleta. A pesquisa manual continua disponível.`,
      );
    }
  }
  const message = reports.join(" ");
  await env.DB.prepare("INSERT INTO editorial_jobs VALUES(?,?,?,?,?)")
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      "radar",
      Number(!reports.some((r) => r.includes("falha"))),
      message,
    )
    .run();
  return { message };
}
