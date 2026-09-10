import "./editorial.css";
import {
  CHANNELS,
  LABELS,
  monthLast,
  monthShift,
  type CalendarItem,
  type Publication,
  type News,
  type EditorialSnapshot,
} from "./editorial-domain";
import {
  METRICS,
  type Definition,
  type Achievement,
} from "./editorial-milestones";
import {
  localDay,
  addDays,
  START,
  dayNumber,
  brl,
  totals,
  type Purchase,
  type Quote,
} from "./domain";
import { downloadBlob } from "./art";
import { renderEditorial, exportEditorial } from "./editorial-art";
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
type Version = {
  id: string;
  created_at: string;
  snapshot_json: string;
  reviewed_at: string | null;
};
type Detail = {
  item: CalendarItem;
  versions: Version[];
  publications: Publication[];
  news: News[];
  history: { action: string; created_at: string; details_json: string }[];
  event: any;
};
const e = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const today = () => localDay(new Date().toISOString());
const pretty = (v: string) => v.replaceAll("_", " ");
const stamp = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const dl = (name: string, text: string, type = "text/plain") =>
  downloadBlob(new Blob([text], { type }), name);
const input = (label: string, name: string, value: string, type = "text") =>
  `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" required></label>`;
export async function mountEditorial(
  root: HTMLElement,
  api: Api,
  notify: (s: string, error?: boolean) => void,
  milestones = false,
) {
  let month = today().slice(0, 7),
    filter = "all",
    kind = "all",
    items: CalendarItem[] = [],
    settings = { monthly_day: 1, horizon: 3 };
  const run = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (err) {
      notify((err as Error).message, true);
    }
  };
  const on = (selector: string, fn: () => Promise<void>) => {
    root.querySelector<HTMLButtonElement>(selector)!.onclick = run(fn);
  };
  async function load() {
    if (milestones) {
      await loadMilestones();
      return;
    }
    const data = await api(
      "editorial/data?month=" + month + "&scope=" + filter,
    );
    if (!root.isConnected) return;
    items = data.items;
    settings = data.settings;
    const pending = items.filter(
      (i) => !["publicado", "cancelado", "pausado"].includes(i.state!),
    );
    root.innerHTML = `<section class="editorial-hero"><div><p class="eyebrow">PLANEJAR • CRIAR • CONFERIR</p><h2>Seu próximo conteúdo começa aqui.</h2><p>Uma rotina por dia, resumos por mês e espaço para cada conquista.</p></div><strong>${pending.length}<small>itens pendentes na seleção</small></strong></section>
 <section class="panel"><div class="editorial-toolbar"><label>Mês<input id="cal-month" type="month" value="${month}"></label><label>Planejar<select id="horizon">${[1, 3, 6, 12].map((n) => `<option value="${n}" ${n === settings.horizon ? "selected" : ""}>${n} mês(es)</option>`).join("")}</select></label><label>Início dos mensais<input id="monthly-day" type="number" min="1" max="28" value="${settings.monthly_day}"></label><button id="plan" class="primary">Gerar calendário</button><button id="ics">Exportar agenda</button><button id="csv">Relatório CSV</button></div><p class="hint">Gerar novamente preserva itens existentes. Conteúdos mensais começam no dia escolhido do mês seguinte. Você pode reagendar cada item.</p></section>
 <div class="editorial-toolbar"><label>Mostrar<select id="filter">${[
   ["all", "Todos"],
   ["today", "Hoje"],
   ["week", "Próximos 7 dias"],
   ["late", "Atrasados"],
   ["pending", "Pendentes"],
   ["review", "Gerados para revisão"],
   ["published", "Publicados"],
 ]
   .map(
     ([v, l]) =>
       `<option value="${v}" ${filter === v ? "selected" : ""}>${l}</option>`,
   )
   .join(
     "",
   )}</select></label><label>Conteúdo<select id="kind"><option value="all">Todos os tipos</option>${Object.entries(
   LABELS,
 )
   .map(
     ([v, l]) =>
       `<option value="${v}" ${kind === v ? "selected" : ""}>${l}</option>`,
   )
   .join(
     "",
   )}</select></label><p class="hint">Confirmação manual por rede. Nenhum post é enviado automaticamente.</p></div><div id="calendar-grid"></div><details class="panel"><summary>Execuções automáticas</summary>${data.jobs.length ? data.jobs.map((j: any) => `<p>${e(stamp(j.executed_at))} · ${e(j.job)} · ${e(j.message)}</p>`).join("") : "<p>A primeira manutenção ocorrerá na próxima execução agendada.</p>"}</details>`;
    root.querySelector<HTMLInputElement>("#cal-month")!.onchange = run(
      async () => {
        month = root.querySelector<HTMLInputElement>("#cal-month")!.value;
        await load();
      },
    );
    for (const key of ["filter", "kind"])
      root.querySelector<HTMLSelectElement>("#" + key)!.onchange = run(
        async () => {
          const v = root.querySelector<HTMLSelectElement>("#" + key)!.value;
          if (key === "filter") filter = v;
          else kind = v;
          if (key === "filter") await load();
          else draw();
        },
      );
    on("#plan", async () => {
      await api("editorial/calendar", "POST", {
        month,
        months: Number(
          root.querySelector<HTMLSelectElement>("#horizon")!.value,
        ),
        monthlyDay: Number(
          root.querySelector<HTMLInputElement>("#monthly-day")!.value,
        ),
      });
      notify("Calendário atualizado, sem duplicar itens.");
      await load();
    });
    on("#ics", async () => {
      const esc = (s: string) =>
        s
          .replaceAll("\\", "\\\\")
          .replaceAll("\n", "\\n")
          .replaceAll(",", "\\,")
          .replaceAll(";", "\\;");
      const body = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Dez em Bitcoin//Calendario//PT-BR",
        ...items
          .filter((i) => i.lifecycle !== "cancelled")
          .flatMap((i) => [
            "BEGIN:VEVENT",
            `UID:${i.id}@dezembitcoin`,
            `DTSTAMP:${new Date()
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d{3}/, "")}`,
            `DTSTART;VALUE=DATE:${i.planned_date.replaceAll("-", "")}`,
            `DTEND;VALUE=DATE:${addDays(i.planned_date, 1).replaceAll("-", "")}`,
            `SUMMARY:${esc(i.title)}`,
            `DESCRIPTION:${esc(pretty(i.state!) + "\n" + i.note)}`,
            "END:VEVENT",
          ]),
        "END:VCALENDAR",
      ].join("\r\n");
      dl(`calendario-${month}.ics`, body, "text/calendar");
    });
    on("#csv", async () => {
      const cell = (s: unknown) =>
        '"' +
        String(s ?? "")
          .replace(/^[=+@-]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      dl(
        `editorial-${month}.csv`,
        "\ufeff" +
          [
            [
              "Data",
              "Prazo",
              "Conteúdo",
              "Tipo",
              "Estado",
              "Redes",
              "Pendências",
            ],
            ...items.map((i) => [
              i.planned_date,
              i.deadline,
              i.title,
              LABELS[i.kind],
              i.state,
              i.channels_json,
              i.pending?.join(" "),
            ]),
          ]
            .map((row) => row.map(cell).join(";"))
            .join("\r\n"),
        "text/csv",
      );
    });
    draw();
  }
  function draw() {
    const visible = items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        {
          all: true,
          today: i.planned_date === today(),
          week:
            i.planned_date >= today() && i.planned_date < addDays(today(), 7),
          late:
            i.deadline < today() &&
            !["publicado", "cancelado", "pausado"].includes(i.state!),
          pending: !["publicado", "cancelado", "pausado"].includes(i.state!),
          review: i.state === "gerado",
          published:
            i.state === "publicado" || i.state === "publicado_parcialmente",
        }[filter],
    );
    const grid = root.querySelector("#calendar-grid")!;
    if (filter !== "all" || kind !== "all") {
      grid.innerHTML = `<div class="editorial-list">${visible.map(card).join("") || '<div class="empty">Nenhum item neste filtro e mês.</div>'}</div>`;
    } else {
      const weekday = new Date(month + "-01T12:00:00Z").getUTCDay(),
        days = Number(monthLast(month).slice(-2));
      grid.innerHTML = `<div class="calendar"><div class="week-label">Dom</div><div class="week-label">Seg</div><div class="week-label">Ter</div><div class="week-label">Qua</div><div class="week-label">Qui</div><div class="week-label">Sex</div><div class="week-label">Sáb</div>${'<div class="calendar-blank"></div>'.repeat(weekday)}${Array.from(
        { length: days },
        (_, index) => {
          const date = month + "-" + String(index + 1).padStart(2, "0");
          return `<section class="calendar-day ${date === today() ? "is-today" : ""}"><div class="calendar-number">${index + 1}${date === today() ? "<small>hoje</small>" : ""}</div>${visible
            .filter((i) => i.planned_date === date)
            .map(card)
            .join("")}</section>`;
        },
      ).join(
        "",
      )}</div>${!items.length ? '<div class="empty"><h2>Seu calendário está pronto para começar.</h2><p>Escolha quantos meses planejar e clique em Gerar calendário.</p></div>' : ""}`;
    }
    root
      .querySelectorAll<HTMLButtonElement>("[data-item]")
      .forEach((b) => (b.onclick = run(() => open(b.dataset.item!))));
  }
  function card(i: CalendarItem) {
    return `<button class="calendar-card state-${i.state}" data-item="${e(i.id)}"><small>${e(LABELS[i.kind])}${i.extra ? " · extra" : ""}</small><strong>${e(i.title)}</strong><span>${e(pretty(i.state!))}</span>${i.deadline < today() && !["publicado", "cancelado", "pausado"].includes(i.state!) ? "<em>Atrasado</em>" : ""}</button>`;
  }
  async function open(id: string) {
    const d: Detail = await api("editorial/items/" + encodeURIComponent(id));
    if (!root.isConnected) return;
    const i = d.item,
      version = d.versions.find((v) => v.id === i.current_version),
      snapshot: EditorialSnapshot | undefined = version
        ? JSON.parse(version.snapshot_json)
        : undefined;
    root.querySelector("dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.className = "editorial-dialog";
    root.append(dialog);
    const channels: string[] = JSON.parse(i.channels_json);
    dialog.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">${e(LABELS[i.kind])}</p><h2>${e(i.title)}</h2></div><button id="close-dialog" aria-label="Fechar conteúdo">✕</button></div><p>Período: ${e(i.period_start)} a ${e(i.period_end)}. ${d.event ? "Marco atingido em " + e(stamp(d.event.achieved_at)) + "." : ""}</p>
 <details><summary>Planejamento e observações</summary><form id="item-form"><div class="form-grid">${input("Data planejada", "planned_date", i.planned_date, "date")}${input("Prazo", "deadline", i.deadline, "date")}${input("Título", "title", i.title)}<label>Estado<select name="lifecycle">${[
   ["active", "Ativo"],
   ["paused", "Pausado"],
   ["cancelled", "Cancelado"],
 ]
   .map(
     ([v, l]) =>
       `<option value="${v}" ${i.lifecycle === v ? "selected" : ""}>${l}</option>`,
   )
   .join(
     "",
   )}</select></label></div><label>Observação pessoal / texto editorial<textarea name="note" rows="4" maxlength="2400">${e(i.note)}</textarea></label><label>Motivo do cancelamento ou substituição<input name="cancel_reason" value="${e(i.cancel_reason)}"></label><div class="editorial-toolbar">${CHANNELS.map((c) => `<label class="check"><input type="checkbox" name="channel" value="${c}" ${channels.includes(c) ? "checked" : ""}>${c === "youtube" ? "YouTube / Shorts" : c}</label>`).join("")}<label class="check"><input type="checkbox" name="extra" ${i.extra ? "checked" : ""}>Conteúdo extra</label></div><button class="primary">Salvar planejamento</button><p class="hint">Alterar texto exige nova geração. Versões e confirmações anteriores permanecem no histórico. Para combinar conteúdos, registre o vínculo na observação e pause ou cancele o item substituído.</p></form></details>
 ${
   i.kind === "radar"
     ? `<section class="panel"><h3>Radar • fatos, contexto e comentário</h3><p>A coleta traz títulos e links candidatos. O resumo e o comentário precisam de pesquisa e revisão.</p><div class="editorial-toolbar"><button id="collect">Buscar fontes RSS</button><button id="research">Copiar prompt de pesquisa</button><button id="news-example">Baixar modelo JSON</button></div><label>Importar pesquisa (.json)<input id="news-file" type="file" accept=".json,application/json"></label><form id="news-form"><label>Notícias — JSON editável<textarea id="news-json" rows="14" spellcheck="false">${e(
         JSON.stringify(
           d.news.map(({ id, item_id, selected, reviewed, ...n }) => ({
             ...n,
             selected: !!selected,
             reviewed: !!reviewed,
           })),
           null,
           2,
         ),
       )}</textarea></label><p class="hint">Até cinco selecionadas. Marque reviewed=true somente após conferir a fonte, a data, o resumo, o contexto e o comentário. Sem fatos relevantes? Cancele o item com esse motivo.</p><button>Salvar notícias</button></form>${d.news.map((n) => `<p><a href="${e(n.url)}" target="_blank" rel="noopener noreferrer">${e(n.title)}</a> · ${e(n.source)} · ${e(stamp(n.published_at))}</p>`).join("")}</section>`
     : ""
 }
 <section class="panel"><div class="editorial-toolbar"><button id="generate" class="primary">${version ? "Gerar nova versão" : "Gerar conteúdo"}</button>${version ? '<button id="zip">Baixar pacote ZIP</button><button id="prompt">Copiar prompt para IA</button>' : ""}</div>${
   !version
     ? '<p class="hint">A geração verifica compras, cotação e observações necessárias. As pendências serão informadas.</p>'
     : `<p>Versão de ${e(stamp(version.created_at))} • ${version.reviewed_at ? "revisada" : "aguardando revisão"}</p><div id="art-pages" class="art-pages"></div><details><summary>Editar textos do carrossel</summary><p class="hint">Cria outra versão para revisão. Confira os números com o snapshot antes de publicar.</p><form id="pages-form"><textarea id="pages-json" rows="12" spellcheck="false">${e(
         JSON.stringify(
           snapshot!.pages.map(({ chart, ...p }) => p),
           null,
           2,
         ),
       )}</textarea><button>Salvar nova versão dos textos</button></form></details><div class="caption-tabs">${Object.entries(
         snapshot!.captions,
       )
         .map(
           ([k, v]) =>
             `<label>${e(k)}<textarea rows="4" readonly>${e(v)}</textarea><button data-copy="${k}">Copiar texto</button></label>`,
         )
         .join(
           "",
         )}</div><label class="check"><input id="review-check" type="checkbox">Conferi números, datas, fontes, texto e todas as páginas desta versão.</label><button id="review">Confirmar revisão</button>`
 }</section>
 <section class="panel"><h3>Confirmar postagem manual</h3><p>Marque somente depois de publicar na rede. O registro guarda a versão usada.</p>${channels
   .map((c) => {
     const p = d.publications.find((p) => p.channel === c);
     return `<div class="publication-row"><strong>${e(c)}</strong>${p ? `<span>✓ ${e(stamp(p.published_at))}${p.version_id !== i.current_version ? " · versão anterior" : ""}${p.url ? ` · <a href="${e(p.url)}" target="_blank" rel="noopener noreferrer">Ver post</a>` : ""}</span><button data-undo="${c}">Desfazer confirmação</button>` : `<span>Pendente</span><button data-publish="${c}" ${version?.reviewed_at ? "" : "disabled"}>Confirmar</button>`}</div>`;
   })
   .join(
     "",
   )}<div class="form-grid">${input("Data/hora da publicação (Brasília)", "published_at", today() + "T" + new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }), "datetime-local")}<label>URL (uma rede por vez)<input id="publication-url" type="url"></label></div><label>Observação<input id="publication-note" maxlength="600"></label><label class="check"><input id="published-check" type="checkbox">Confirmo que já publiquei o conteúdo nos canais que vou marcar.</label><button id="publish-all" ${version?.reviewed_at ? "" : "disabled"}>Marcar redes pendentes como publicadas</button></section>
 <details class="panel"><summary>Versões arquivadas (${d.versions.length}) e histórico</summary>${d.versions.map((v) => `<p>${e(stamp(v.created_at))} · ${v.reviewed_at ? "revisada" : "rascunho"} <button data-version="${e(v.id)}">Baixar versão</button></p>`).join("")}${d.history.map((h) => `<details><summary>${e(stamp(h.created_at))} · ${e(pretty(h.action))} · proprietário</summary><pre>${e(JSON.stringify(JSON.parse(h.details_json), null, 2))}</pre></details>`).join("")}</details>`;
    dialog.showModal();
    if (i.kind === "daily")
      dialog.querySelector("#pages-form")?.closest("details")?.remove();
    dialog.querySelector<HTMLButtonElement>("#close-dialog")!.onclick = () => {
      dialog.close();
      dialog.remove();
    };
    const action = async (name: string, payload: unknown) => {
      await api(
        "editorial/items/" + encodeURIComponent(id) + (name ? "/" + name : ""),
        name ? "POST" : "PUT",
        { ...(payload as object), revision: i.revision },
      );
      dialog.close();
      dialog.remove();
      await load();
      await open(id);
    };
    const button = (selector: string, fn: () => Promise<void>) => {
      dialog.querySelector<HTMLButtonElement>(selector)!.onclick = run(fn);
    };
    dialog.querySelector<HTMLFormElement>("#item-form")!.onsubmit = (event) => {
      event.preventDefault();
      void run(async () => {
        const f = new FormData(event.target as HTMLFormElement);
        await action("", {
          planned_date: f.get("planned_date"),
          deadline: f.get("deadline"),
          title: f.get("title"),
          note: f.get("note"),
          lifecycle: f.get("lifecycle"),
          cancel_reason: f.get("cancel_reason"),
          extra: f.has("extra"),
          channels: f.getAll("channel"),
        });
      })();
    };
    button("#generate", () => action("generate", {}));
    if (snapshot && version) {
      let canvases: HTMLCanvasElement[] = [];
      try {
        canvases = await renderEditorial(snapshot);
        const area = dialog.querySelector("#art-pages")!;
        canvases.forEach((c, index) => {
          const wrap = document.createElement("div");
          wrap.append(c);
          const b = document.createElement("button");
          b.textContent = `Baixar PNG ${index + 1}`;
          b.onclick = () =>
            c.toBlob(
              (blob) =>
                blob &&
                downloadBlob(
                  blob,
                  `${i.kind}-${i.period_end}-${index + 1}.png`,
                ),
              "image/png",
            );
          wrap.append(b);
          area.append(wrap);
        });
      } catch (err) {
        dialog.querySelector("#art-pages")!.textContent = (
          err as Error
        ).message;
      }
      button("#zip", async () => {
        if (!canvases.length)
          throw new Error("Corrija o texto das páginas antes de exportar.");
        await exportEditorial(snapshot, canvases);
      });
      button("#prompt", async () => {
        await navigator.clipboard.writeText(snapshot.prompt);
        notify("Prompt copiado.");
      });
      dialog.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach(
        (b) =>
          (b.onclick = run(async () => {
            await navigator.clipboard.writeText(
              snapshot.captions[
                b.dataset.copy as keyof typeof snapshot.captions
              ],
            );
            notify("Texto copiado.");
          })),
      );
      button("#review", async () => {
        if (!canvases.length)
          throw new Error(
            "Corrija o texto e gere todas as páginas antes de revisar.",
          );
        if (!dialog.querySelector<HTMLInputElement>("#review-check")!.checked)
          throw new Error("Confira as páginas e marque a revisão.");
        await action("review", { versionId: version.id, confirmed: true });
      });
      const pagesForm = dialog.querySelector<HTMLFormElement>("#pages-form");
      if (pagesForm)
        pagesForm.onsubmit = (event) => {
          event.preventDefault();
          void run(() =>
            action("draft", {
              pages: JSON.parse(
                dialog.querySelector<HTMLTextAreaElement>("#pages-json")!.value,
              ),
            }),
          )();
        };
    }
    const publish = async (list: string[]) => {
      if (!dialog.querySelector<HTMLInputElement>("#published-check")!.checked)
        throw new Error(
          "Marque a confirmação de que publicou nas redes selecionadas.",
        );
      if (!list.length) throw new Error("Todas as redes já foram confirmadas.");
      await action("publish", {
        versionId: version?.id,
        channels: list,
        confirmed: true,
        published_at: new Date(
          dialog.querySelector<HTMLInputElement>("[name=published_at]")!.value +
            ":00-03:00",
        ).toISOString(),
        url: dialog.querySelector<HTMLInputElement>("#publication-url")!.value,
        note: dialog.querySelector<HTMLInputElement>("#publication-note")!
          .value,
      });
    };
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-publish]")
      .forEach((b) => (b.onclick = run(() => publish([b.dataset.publish!]))));
    button("#publish-all", () =>
      publish(
        channels.filter((c) => !d.publications.some((p) => p.channel === c)),
      ),
    );
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-undo]")
      .forEach(
        (b) =>
          (b.onclick = run(() => action("undo", { channel: b.dataset.undo! }))),
      );
    dialog.querySelectorAll<HTMLButtonElement>("[data-version]").forEach(
      (b) =>
        (b.onclick = run(async () => {
          const s: EditorialSnapshot = JSON.parse(
            d.versions.find((v) => v.id === b.dataset.version)!.snapshot_json,
          );
          await exportEditorial(s, await renderEditorial(s));
        })),
    );
    if (i.kind === "radar") {
      const newsForm = dialog.querySelector<HTMLFormElement>("#news-form")!;
      let editingNews = d.news.map(
        ({ id, item_id, selected, reviewed, ...n }) => ({
          ...n,
          classification:
            n.classification === "inferencia" ? "inferencia" : "analise",
          selected: !!selected,
          reviewed: !!reviewed,
        }),
      );
      const readNews = () =>
        [...newsForm.querySelectorAll<HTMLFieldSetElement>("fieldset")].map(
          (field) => {
            const value = (key: string) =>
              field.querySelector<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >(`[data-field="${key}"]`)!.value;
            const checked = (key: string) =>
              field.querySelector<HTMLInputElement>(`[data-field="${key}"]`)!
                .checked;
            return {
              url: value("url"),
              title: value("title"),
              source: value("source"),
              published_at: new Date(
                value("published_at") + ":00-03:00",
              ).toISOString(),
              event_date: value("event_date"),
              summary: value("summary"),
              context: value("context"),
              impact: value("impact"),
              classification: value("classification"),
              selected: checked("selected"),
              reviewed: checked("reviewed"),
            };
          },
        );
      const drawNews = () => {
        newsForm.innerHTML =
          editingNews
            .map(
              (n, index) =>
                `<fieldset class="news-card"><legend>Notícia ${index + 1}</legend><div class="form-grid">${[
                  ["Título", "title", "text"],
                  ["URL da fonte", "url", "url"],
                  ["Fonte", "source", "text"],
                  ["Publicada em (Brasília)", "published_at", "datetime-local"],
                  ["Data do fato, se conhecida", "event_date", "date"],
                ]
                  .map(([label, key, type]) => {
                    const v =
                      key === "published_at"
                        ? new Date(Date.parse(n.published_at) - 3 * 3600000)
                            .toISOString()
                            .slice(0, 16)
                        : n[key as keyof typeof n];
                    return `<label>${label}<input data-field="${key}" type="${type}" value="${e(v)}" ${key === "event_date" ? "" : "required"}></label>`;
                  })
                  .join("")}</div>${[
                  ["Fato confirmado", "summary"],
                  ["Contexto", "context"],
                  ["Comentário / possível impacto", "impact"],
                ]
                  .map(
                    ([label, key]) =>
                      `<label>${label}<textarea data-field="${key}" rows="3" maxlength="800">${e(n[key as keyof typeof n])}</textarea></label>`,
                  )
                  .join(
                    "",
                  )}<label>Tipo do comentário<select data-field="classification"><option value="analise" ${n.classification === "analise" ? "selected" : ""}>Análise</option><option value="inferencia" ${n.classification === "inferencia" ? "selected" : ""}>Inferência</option></select></label><label class="check"><input data-field="selected" type="checkbox" ${n.selected ? "checked" : ""}>Incluir no carrossel</label><label class="check"><input data-field="reviewed" type="checkbox" ${n.reviewed ? "checked" : ""}>Conferi os fatos, a fonte e os textos desta notícia</label><button type="button" data-remove-news="${index}">Remover notícia</button></fieldset>`,
            )
            .join("") +
          '<div class="editorial-toolbar"><button id="add-news" type="button">Adicionar notícia</button><button class="primary">Salvar notícias</button></div><p class="hint">Selecione até cinco. Se não houver fatos relevantes, cancele o Radar e registre o motivo.</p>';
        newsForm
          .querySelectorAll<HTMLButtonElement>("[data-remove-news]")
          .forEach(
            (b) =>
              (b.onclick = run(async () => {
                editingNews = readNews();
                editingNews.splice(Number(b.dataset.removeNews), 1);
                drawNews();
              })),
          );
        newsForm.querySelector<HTMLButtonElement>("#add-news")!.onclick = run(
          async () => {
            editingNews = readNews();
            if (editingNews.length >= 20)
              throw new Error("Limite de 20 candidatas.");
            editingNews.push({
              url: "",
              title: "",
              source: "",
              published_at: new Date().toISOString(),
              event_date: "",
              summary: "",
              context: "",
              impact: "",
              classification: "analise",
              selected: false,
              reviewed: false,
            });
            drawNews();
          },
        );
      };
      drawNews();
      button("#collect", async () => {
        const r = await api(
          "editorial/items/" + encodeURIComponent(id) + "/collect",
          "POST",
          { revision: i.revision },
        );
        notify(r.message);
        dialog.close();
        await open(id);
      });
      const example = [
        {
          url: "https://exemplo.com/noticia",
          title: "Título confirmado",
          source: "Nome da fonte",
          published_at: i.period_end + "T15:00:00.000Z",
          event_date: i.period_end,
          summary: "Fato confirmado na fonte.",
          context: "Contexto documentado.",
          impact: "Comentário, sem previsão de preço.",
          classification: "inferencia",
          selected: true,
          reviewed: false,
        },
      ];
      button("#news-example", async () =>
        dl(
          "modelo-radar.json",
          JSON.stringify(example, null, 2),
          "application/json",
        ),
      );
      button("#research", async () => {
        await navigator.clipboard.writeText(
          `Pesquise notícias cripto publicadas entre ${i.period_start} e ${i.period_end} (America/Sao_Paulo), sem incluir fatos posteriores ao horário atual. Priorize fontes primárias, confirme URL, data de publicação e data do fato. Selecione até cinco notícias relevantes. Separe fato, contexto e comentário/inferência; sem previsão de preço. Não invente experiências pessoais. Retorne somente um array JSON no formato abaixo, com reviewed=false para revisão manual. Se não houver notícias relevantes, retorne [].\n${JSON.stringify(example, null, 2)}`,
        );
        notify("Prompt de pesquisa copiado.");
      });
      dialog.querySelector<HTMLInputElement>("#news-file")!.onchange = run(
        async () => {
          const file =
            dialog.querySelector<HTMLInputElement>("#news-file")!.files?.[0];
          if (file) {
            if (file.size > 60000) throw new Error("Arquivo maior que 60 KB.");
            const imported = JSON.parse(await file.text());
            if (
              !Array.isArray(imported) ||
              imported.length > 20 ||
              imported.some(
                (n) =>
                  typeof n.url !== "string" ||
                  typeof n.title !== "string" ||
                  !Number.isFinite(Date.parse(n.published_at)),
              )
            )
              throw new Error("Arquivo inválido. Use o modelo de pesquisa.");
            editingNews = imported.map((n) => ({
              url: n.url,
              title: n.title,
              source: n.source ?? "",
              published_at: n.published_at,
              event_date: n.event_date ?? "",
              summary: n.summary ?? "",
              context: n.context ?? "",
              impact: n.impact ?? "",
              classification:
                n.classification === "inferencia" ? "inferencia" : "analise",
              selected: n.selected === true,
              reviewed: false,
            }));
            drawNews();
            notify("Pesquisa carregada. Confira os textos antes de salvar.");
          }
        },
      );
      dialog.querySelector<HTMLFormElement>("#news-form")!.onsubmit = (
        event,
      ) => {
        event.preventDefault();
        void run(() =>
          action("news", {
            news: readNews(),
          }),
        )();
      };
    }
  }
  async function loadMilestones() {
    const data: {
      definitions: Definition[];
      events: any[];
      evaluated: Achievement[];
      purchases: Purchase[];
      quote: Quote | null;
    } = await api("editorial/milestones");
    if (!root.isConnected) return;
    const ds = [
      ...new Set(data.purchases.map((p) => localDay(p.purchased_at))),
    ].sort();
    let streak = 0;
    for (let d = today(); ds.includes(d); d = addDays(d, -1)) streak++;
    const total = totals(data.purchases, data.quote?.price ?? "0");
    const current: Record<string, number> = {
      calendar_days: dayNumber(today()),
      purchase_days: ds.length,
      streak,
      contributions: Number(total.contributed),
      sats: total.sats,
      wallet: data.quote
        ? Number(
            totals(
              data.purchases.filter(
                (p) => p.purchased_at <= data.quote!.captured_at,
              ),
              data.quote.price,
            ).value,
          )
        : 0,
    };
    root.innerHTML = `<section class="editorial-hero"><div><p class="eyebrow">CADA PASSO TEM SUA HISTÓRIA</p><h2>Conquistas que ficam registradas.</h2><p>Dias corridos, dias com compra e sequência são contagens diferentes.</p></div><strong>${data.events.length}<small>marcos registrados</small></strong></section><div class="editorial-toolbar"><button id="sync" class="primary">Analisar marcos agora</button><p>Marcos são criados como conteúdos extras, sem substituir a rotina.</p></div><section class="panel"><h3>Próximos marcos</h3><div class="milestone-grid">${
      data.definitions
        .filter(
          (d) =>
            d.active &&
            d.metric in current &&
            !data.events.some((v) => v.definition_id === d.id),
        )
        .sort((a, b) => Number(a.target) - Number(b.target))
        .map(
          (d) =>
            `<div><small>${e(d.metric === "wallet" ? "Última cotação salva" : pretty(d.metric))}</small><h4>${e(d.title)}</h4><progress max="${e(d.target)}" value="${Math.min(Number(d.target), current[d.metric])}"></progress><p>${current[d.metric].toLocaleString("pt-BR")} / ${Number(d.target).toLocaleString("pt-BR")}</p></div>`,
        )
        .join("") || "<p>Analise os marcos para carregar os alvos iniciais.</p>"
    }</div></section><section class="panel"><h3>Marcos atingidos</h3>${data.events.map((v) => `<div class="publication-row"><div><strong>${e(data.definitions.find((d) => d.id === v.definition_id)?.title)}</strong><p>${e(stamp(v.achieved_at))}${!data.evaluated.some((a) => a.key === v.event_key && a.value === v.value && a.achievedAt === v.achieved_at) ? " · Atenção: o histórico atual diverge do registro original. Confira correções nas compras/cotações." : ""}</p></div><button data-event="${e(v.item_id)}">Criar / ver publicação</button></div>`).join("") || "<p>Nenhum marco atingido ainda.</p>"}</section><details class="panel"><summary>Adicionar um alvo personalizado</summary><form id="definition"><div class="form-grid"><label>Métrica<select name="metric">${[
      ["calendar_days", "Dias corridos"],
      ["purchase_days", "Dias com compra"],
      ["streak", "Dias consecutivos"],
      ["contributions", "Aportes em reais"],
      ["sats", "Satoshis líquidos"],
      ["wallet", "Carteira em reais"],
    ]
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join(
        "",
      )}</select></label>${input("Alvo", "target", "100", "number")}${input("Nome do marco", "title", "Meu próximo marco")}</div><button>Salvar e analisar</button></form></details>`;
    on("#sync", async () => {
      const result = await api("editorial/milestones/sync", "POST", {});
      notify(`${result.created} novos marcos registrados.`);
      await loadMilestones();
    });
    root
      .querySelectorAll<HTMLButtonElement>("[data-event]")
      .forEach((b) => (b.onclick = run(() => open(b.dataset.event!))));
    root.querySelector<HTMLFormElement>("#definition")!.onsubmit = (event) => {
      event.preventDefault();
      void run(async () => {
        const f = new FormData(event.target as HTMLFormElement);
        await api("editorial/milestones", "POST", {
          metric: f.get("metric"),
          target: Number(f.get("target")),
          title: f.get("title"),
        });
        await loadMilestones();
      })();
    };
  }
  await load();
}
