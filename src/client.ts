import "./style.css";
import Decimal from "decimal.js";
import {
  START,
  addDays,
  dayNumber,
  localDay,
  localTime,
  brl,
  btc,
  pct,
  totals,
  type Purchase,
  type Quote,
  type Snapshot,
} from "./domain";
import { renderArt, downloadArt, downloadBlob } from "./art";
type Content = {
  id: string;
  created_at: string;
  title: string;
  channels_json: string;
};
type Run = {
  attempted_at: string;
  kind: string;
  success: number;
  message: string;
};
type Data = {
  purchases: Purchase[];
  quotes: Quote[];
  contents: Content[];
  runs: Run[];
};
let data: Data = { purchases: [], quotes: [], contents: [], runs: [] },
  page = "dashboard",
  snapshot: Snapshot | null = null,
  editId: string | null = null;
const app = document.querySelector<HTMLDivElement>("#app")!;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
const today = () => localDay(new Date().toISOString());
const dateLabel = (s: string) => s.split("-").reverse().join("/");
const labelKind = (kind: string) =>
  ({ midday: "Meio-dia", close: "Fechamento", manual: "Consulta manual" })[
    kind
  ] ?? kind;
const msg = (value: string, error = false) => {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.append(el);
  }
  el.textContent = value;
  el.className = error ? "error" : "";
  setTimeout(() => el?.remove(), 6500);
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  if (!r.ok) {
    if (r.status === 401 && path !== "login") login();
    throw new Error(result.error ?? "Não foi possível concluir.");
  }
  return result;
}
async function refresh() {
  data = await api("data");
}
function login() {
  app.innerHTML = `<main class="login"><img src="/logo.png" alt="Dez em Bitcoin"><p class="eyebrow">SEU DIÁRIO DE CONSTÂNCIA</p><h1>Dez por dia.<br><span>Um passo de cada vez.</span></h1><p>Compras, resultados e conteúdo. Tudo no mesmo lugar.</p><form id="login"><label>Senha do seu diário<input name="password" type="password" autocomplete="current-password" minlength="16" required></label><button class="primary">Entrar no diário →</button><p id="login-error" role="alert"></p></form><small>Uma jornada rumo ao milhão. Sem atalhos.</small></main>`;
  document.querySelector("#login")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = document.querySelector<HTMLButtonElement>("#login button")!;
    button.disabled = true;
    try {
      await api("login", "POST", {
        password: new FormData(e.target as HTMLFormElement).get("password"),
      });
      await refresh();
      render();
    } catch (e) {
      document.querySelector("#login-error")!.textContent = (
        e as Error
      ).message;
    } finally {
      button.disabled = false;
    }
  });
}
function render() {
  const nav = [
    ["dashboard", "Visão geral", "◫"],
    ["purchases", "Compras", "＋"],
    ["quotes", "Cotações", "↗"],
    ["content", "Criar conteúdo", "▧"],
    ["archive", "Publicações", "▤"],
  ];
  app.innerHTML = `<aside><a class="brand" href="#dashboard"><img src="/logo.png" alt=""><strong>DEZ EM<br>BITCOIN</strong></a><p class="nav-label">SEU DESAFIO</p><nav>${nav.map(([id, name, icon]) => `<button data-page="${id}" class="${page === id ? "active" : ""}"><span>${icon}</span>${name}</button>`).join("")}</nav><div class="aside-bottom"><span class="live-dot"></span> Diário privado<button id="backup">↓ Exportar backup</button><button id="logout">Sair</button></div></aside><main class="workspace"><header><div><p class="eyebrow">DEZ POR DIA, RUMO AO MILHÃO</p><h1>${nav.find((n) => n[0] === page)?.[1]}</h1></div><div class="header-date">${dateLabel(today())}<span>Dia ${dayNumber(today())} do desafio</span></div></header><div id="page"></div></main>`;
  document.querySelectorAll<HTMLButtonElement>("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.page!;
        editId = null;
        render();
      }),
  );
  document.querySelector("#logout")!.addEventListener("click", () =>
    act(async () => {
      await api("logout", "POST", {});
      login();
    }),
  );
  document.querySelector("#backup")!.addEventListener("click", () =>
    act(async () => {
      const result = await api("backup");
      downloadBlob(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
        `dez-em-bitcoin-backup-${today()}.json`,
      );
      msg("Backup exportado. Guarde em um local seguro.");
    }),
  );
  (({ dashboard, purchases, quotes, content, archive })[page] ?? dashboard)();
}
async function act(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    msg((e as Error).message, true);
  }
}
const el = () => document.querySelector<HTMLDivElement>("#page")!;
function empty(title: string, detail: string) {
  return `<div class="empty"><span>₿</span><h2>${title}</h2><p>${detail}</p></div>`;
}
function chart() {
  const qs = data.quotes.filter((q) => q.kind === "close").slice(-60);
  if (qs.length < 2)
    return `<div class="chart-empty">O gráfico aparece após dois fechamentos.<br><small>As cotações são coletadas diariamente, mesmo quando você não abre o diário.</small></div>`;
  const values = qs.map((q) => {
    const t = totals(
      data.purchases.filter((p) => p.purchased_at <= q.captured_at),
      q.price,
    );
    return { value: Number(t.value), cost: Number(t.contributed) };
  });
  const max = Math.max(...values.flatMap((v) => [v.value, v.cost]), 1) * 1.1;
  const points = (key: "value" | "cost") =>
    values
      .map(
        (v, i) =>
          `${20 + (i * 860) / (values.length - 1)},${190 - (v[key] / max) * 165}`,
      )
      .join(" ");
  return `<svg viewBox="0 0 900 220" role="img" aria-label="Evolução da carteira em laranja e aportes em cinza"><path d="M20 190H880 M20 100H880 M20 25H880" stroke="#292d31" fill="none"/><polyline points="${points("cost")}" stroke="#8b939e" stroke-width="2" fill="none" stroke-dasharray="6 5"/><polyline points="${points("value")}" stroke="#ffa129" stroke-width="3" fill="none"/></svg><div class="chart-dates"><span>${dateLabel(qs[0].day)}</span><span>${dateLabel(qs.at(-1)!.day)}</span></div>`;
}
function dashboard() {
  const q = data.quotes.at(-1),
    t = totals(data.purchases, q?.price ?? "0");
  const purchasedToday = data.purchases.some(
    (p) => localDay(p.purchased_at) === today(),
  );
  el().innerHTML = `<section class="welcome"><div><p class="eyebrow">A CONSTÂNCIA CONSTRÓI A HISTÓRIA</p><h2>Cada compra conta.</h2><p>${purchasedToday ? "Sua compra de hoje já está registrada." : "Registre sua compra e acompanhe o próximo passo."}</p></div><button class="primary" id="new-purchase">＋ Registrar compra</button></section>
 <section class="stats"><article class="stat hero"><p>Valor estimado da carteira</p><strong>${q ? brl(t.value) : "—"}</strong><small>${q ? esc(localTime(q.captured_at)) + " · Brasília" : "Aguardando primeira cotação"}</small></article><article class="stat"><p>Total aportado</p><strong>${brl(t.contributed)}</strong><small>Inclui taxas das compras</small></article><article class="stat"><p>Resultado acumulado</p><strong class="${Number(t.result) < 0 ? "negative" : "positive"}">${q ? brl(t.result) : "—"}</strong><small>${q ? pct(t.percent) : "Sem cotação"}</small></article><article class="stat"><p>Bitcoin acumulado</p><strong class="btc-value">${btc(t.sats)}</strong><small>${t.sats.toLocaleString("pt-BR")} satoshis</small></article></section>
 ${q && data.purchases.some((p) => p.purchased_at > q.captured_at) ? '<div class="notice">A cotação é anterior a uma compra. Consulte uma cotação nova para atualizar a avaliação.</div>' : ""}
 <section class="panel"><div class="section-head"><div><h2>Sua evolução</h2><p>Fechamentos registrados · últimos 60 pontos</p></div><span class="legend">● Carteira <i>┄ Aportes</i></span></div>${chart()}</section>
 <section class="two-col"><article class="panel"><h2>Próximos marcos</h2>${[
   [100, Number(t.contributed), "aportados em reais"],
   [10000, t.sats, "satoshis"],
   [
     30,
     new Set(data.purchases.map((p) => localDay(p.purchased_at))).size,
     "dias com compra",
   ],
 ]
   .map(
     ([target, current, label]) =>
       `<div class="milestone"><div><b>${Number(target).toLocaleString("pt-BR")} ${label}</b><span>${Math.min(100, (Number(current) / Number(target)) * 100).toFixed(1)}%</span></div><progress value="${Math.min(Number(target), Number(current))}" max="${target}"></progress></div>`,
   )
   .join(
     "",
   )}<small>Marcos informativos; os aportes não garantem retorno.</small></article><article class="panel"><h2>Rotina automática</h2><div class="schedule"><b>12h00</b><span>Referência do meio-dia</span></div><div class="schedule"><b>23h55</b><span>Fechamento da carteira</span></div><p>Horários de Brasília, com novas tentativas em caso de falha. O horário real da coleta acompanha cada cotação.</p><button id="collect">Consultar cotação agora</button></article></section>`;
  document.querySelector("#new-purchase")!.addEventListener("click", () => {
    page = "purchases";
    render();
  });
  document.querySelector("#collect")!.addEventListener("click", collect);
}
function collect(e?: Event) {
  const button = e?.currentTarget as HTMLButtonElement | undefined;
  if (button) button.disabled = true;
  void act(async () => {
    await api("quotes", "POST", {});
    await refresh();
    render();
    msg("Cotação registrada.");
  }).finally(() => {
    if (button) button.disabled = false;
  });
}
function purchases() {
  const p = data.purchases.find((p) => p.id === editId);
  const input = (
    name: string,
    label: string,
    value: string,
    type = "text",
    extra = "",
  ) =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  el().innerHTML = `<section class="panel"><div class="section-head"><div><h2>${p ? "Editar compra" : "Registrar compra"}</h2><p>Copie os dados do extrato. O aporte é o valor pago, não o total líquido.</p></div></div><form id="purchase-form"><div class="form-grid">
 ${input("purchased_at", "Data e hora (Brasília)", p ? new Date(Date.parse(p.purchased_at) - 3 * 3600000).toISOString().slice(0, 19) : new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 16), "datetime-local", 'required step="1"')}
 ${input("contribution", "Aporte pago (R$)", p ? (p.contribution_cents / 100).toFixed(2) : "10,00", "text", 'required inputmode="decimal"')}
 ${input("quantity", "Quantidade bruta (BTC)", p ? btc(p.gross_sats) : "", "text", 'required inputmode="decimal" placeholder="0,00000000"')}
 ${input("fee", "Taxa (BTC)", p ? btc(p.fee_sats) : "", "text", 'required inputmode="decimal" placeholder="0,00000000"')}
 ${input("price", "Preço de execução (R$/BTC)", p ? p.price : "", "text", 'required inputmode="decimal" placeholder="403.296,00"')}
 ${input("total", "Total exibido no extrato (R$)", p ? (p.total_cents / 100).toFixed(2) : "", "text", 'required inputmode="decimal"')}
 ${input("operation_id", "ID da operação (opcional)", p?.operation_id ?? "", "text", 'maxlength="100"')}
 <label>Saldo líquido calculado<output id="net-btc">—</output></label></div><label>Observação / aprendizado (opcional)<textarea name="note" maxlength="2000" rows="2" placeholder="Como foi manter o compromisso hoje?">${esc(p?.note ?? "")}</textarea></label><div class="form-actions"><button class="primary">${p ? "Salvar alterações" : "Salvar compra"}</button>${p ? '<button type="button" id="cancel-edit">Cancelar</button>' : ""}<small>O saldo líquido desconta a taxa em BTC uma única vez.</small></div><p id="purchase-warning" class="muted"></p></form></section>
 <section class="panel"><div class="section-head"><h2>Histórico de compras</h2><span>${data.purchases.length} registro(s)</span></div>${
   data.purchases.length
     ? `<div class="table-wrap"><table><thead><tr><th>Data / hora</th><th>Aporte</th><th>BTC líquido</th><th>Taxa (BTC)</th><th>Ações</th></tr></thead><tbody>${[
         ...data.purchases,
       ]
         .reverse()
         .map(
           (p) =>
             `<tr><td>${localTime(p.purchased_at)}</td><td>${brl(p.contribution_cents / 100)}</td><td>${btc(p.gross_sats - p.fee_sats)}</td><td>${btc(p.fee_sats)}</td><td><button data-edit="${p.id}">Editar</button><button data-delete="${p.id}" class="danger">Excluir</button></td></tr>`,
         )
         .join("")}</tbody></table></div>`
     : empty(
         "Seu primeiro passo começa aqui.",
         "Cadastre uma compra para começar seu histórico.",
       )
 }</section>`;
  const form = document.querySelector<HTMLFormElement>("#purchase-form")!;
  const normalize = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  };
  const preview = () => {
    try {
      const fd = new FormData(form),
        q = new Decimal(normalize(fd.get("quantity"))),
        fee = new Decimal(normalize(fd.get("fee")));
      document.querySelector("#net-btc")!.textContent =
        q.sub(fee).toFixed(8).replace(".", ",") + " BTC";
      const net = q.sub(fee).mul(normalize(fd.get("price")));
      document.querySelector("#purchase-warning")!.textContent = new Decimal(
        normalize(fd.get("total")),
      )
        .sub(net)
        .abs()
        .gt("0.02")
        ? "Confira os valores: total do extrato difere do BTC líquido × preço em mais de R$ 0,02."
        : "";
    } catch {
      document.querySelector("#net-btc")!.textContent = "—";
    }
  };
  form.oninput = preview;
  preview();
  form.onsubmit = (e) => {
    e.preventDefault();
    const button = form.querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    void act(async () => {
      const f = new FormData(form);
      const payload = {
        purchased_at: new Date(
          String(f.get("purchased_at")) + "-03:00",
        ).toISOString(),
        operation_id: f.get("operation_id"),
        note: f.get("note"),
        quantity: normalize(f.get("quantity")),
        fee: normalize(f.get("fee")),
        price: normalize(f.get("price")),
        total: normalize(f.get("total")),
        contribution: normalize(f.get("contribution")),
      };
      await api(
        "purchases" + (editId ? "/" + editId : ""),
        editId ? "PUT" : "POST",
        payload,
      );
      editId = null;
      await refresh();
      render();
      msg("Compra salva. Consulte a cotação atual quando desejar.");
    }).finally(() => (button.disabled = false));
  };
  document.querySelector("#cancel-edit")?.addEventListener("click", () => {
    editId = null;
    purchases();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        editId = b.dataset.edit!;
        purchases();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          confirm(
            "Excluir esta compra? Os próximos cálculos serão atualizados. Conteúdos arquivados permanecem preservados.",
          )
        )
          void act(async () => {
            await api("purchases/" + b.dataset.delete, "DELETE");
            await refresh();
            purchases();
          });
      }),
  );
}
function quotes() {
  el().innerHTML = `<section class="panel"><div class="section-head"><div><h2>Cotações que preservam a história</h2><p>Fonte: Bitpreço · último negócio (last). Horários exibidos em Brasília.</p></div><button class="primary" id="collect">Consultar agora</button></div><div class="notice">Uma data sem coleta não tem cotação histórica disponível. A consulta atual não preenche retroativamente esse dia.</div>${
    data.quotes.length
      ? `<div class="table-wrap"><table><thead><tr><th>Coleta real</th><th>Tipo</th><th>Preço BTC</th><th>Timestamp do provedor*</th></tr></thead><tbody>${[
          ...data.quotes,
        ]
          .reverse()
          .map(
            (q) =>
              `<tr><td>${localTime(q.captured_at)}</td><td><span class="badge">${labelKind(q.kind)}</span></td><td>${brl(q.price)}</td><td>${esc(q.source_timestamp)}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><small>*Texto original da API, sem inferir seu fuso. A referência do post usa o horário da coleta.</small>`
      : empty(
          "Ainda não há cotações.",
          "Faça uma consulta agora ou aguarde a próxima coleta automática.",
        )
  }</section><section class="panel"><h2>Últimas tentativas automáticas e manuais</h2>${data.runs.length ? data.runs.map((r) => `<div class="run"><span class="${r.success ? "positive" : "negative"}">${r.success ? "● Sucesso" : "● Falha"}</span><span>${localTime(r.attempted_at)} · ${labelKind(r.kind)}</span><small>${esc(r.message)}</small></div>`).join("") : "<p>As tentativas de coleta aparecerão aqui.</p>"}</section>`;
  document.querySelector("#collect")!.addEventListener("click", collect);
}
function content() {
  el().innerHTML = `<section class="panel"><h2>Transforme seus números em história.</h2><p>Escolha o período e uma cotação salva. As compras posteriores ao corte não entram no cálculo.</p><form id="content-form"><div class="form-grid four"><label>Formato<select name="type"><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label><label>De<input type="date" name="start" value="${today()}" min="${START}" max="${today()}" required></label><label>Até<input type="date" name="end" value="${today()}" min="${START}" max="${today()}" required></label><label>Cotação de referência<select name="quoteId" required></select></label></div><button class="primary">Preparar conteúdo</button></form></section><div id="preview"></div>`;
  const form = document.querySelector<HTMLFormElement>("#content-form")!,
    type = form.elements.namedItem("type") as HTMLSelectElement,
    start = form.elements.namedItem("start") as HTMLInputElement,
    end = form.elements.namedItem("end") as HTMLInputElement,
    quote = form.elements.namedItem("quoteId") as HTMLSelectElement;
  const options = () => {
    quote.innerHTML = data.quotes
      .filter((q) => q.day === end.value)
      .reverse()
      .map(
        (q) =>
          `<option value="${q.id}">${labelKind(q.kind)} · ${localTime(q.captured_at)}</option>`,
      )
      .join("");
    if (!quote.options.length)
      quote.innerHTML = '<option value="">Sem cotação nesta data</option>';
  };
  const sync = () => {
    start.value =
      type.value === "daily"
        ? end.value
        : type.value === "weekly"
          ? [START, addDays(end.value, -6)].sort().at(-1)!
          : [START, end.value.slice(0, 7) + "-01"].sort().at(-1)!;
    start.readOnly = type.value === "daily";
    options();
  };
  type.onchange = sync;
  end.onchange = sync;
  sync();
  form.onsubmit = (e) => {
    e.preventDefault();
    void act(async () => {
      snapshot = await api(
        "snapshot",
        "POST",
        Object.fromEntries(new FormData(form)),
      );
      await preview(snapshot!);
    });
  };
  if (snapshot) void preview(snapshot);
}
async function preview(s: Snapshot, archived = false) {
  const container = document.querySelector("#preview") ?? el();
  container.innerHTML = `<section class="preview-layout"><article class="panel art-panel"><div class="section-head"><h2>${archived ? "Versão arquivada" : "Prévia da arte"}</h2><span class="badge">1080 × 1350</span></div><div id="canvas-holder"></div><div class="form-actions"><button class="primary" id="download-art">↓ Baixar PNG</button>${!archived ? '<button id="save-content">Arquivar versão</button>' : ""}</div></article><article class="panel"><h2>Textos para publicar</h2>${s.warnings.map((w) => `<div class="notice">${esc(w)}</div>`).join("")}<button id="copy-data">Copiar dados para conteúdo</button>${Object.entries(
    s.captions,
  )
    .map(
      ([key, value]) =>
        `<label class="caption-label">${({ instagram: "Instagram", threads: "Threads", youtubeTitle: "Título YouTube / Shorts", youtube: "Descrição YouTube / Shorts" } as Record<string, string>)[key]}<textarea id="caption-${key}" rows="${key === "youtubeTitle" ? 2 : 7}" readonly>${esc(value)}</textarea><button data-copy="${key}">Copiar texto</button></label>`,
    )
    .join(
      "",
    )}<p class="muted">As legendas descrevem os dados. Revise e acrescente seu relato antes de publicar.</p></article></section>`;
  document.querySelector("#canvas-holder")!.append(await renderArt(s));
  document
    .querySelector("#download-art")!
    .addEventListener("click", () => act(() => downloadArt(s)));
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach(
    (b) =>
      (b.onclick = () =>
        void act(async () => {
          await navigator.clipboard.writeText(
            s.captions[b.dataset.copy as keyof Snapshot["captions"]],
          );
          msg("Texto copiado.");
        })),
  );
  document.querySelector("#copy-data")!.addEventListener("click", () =>
    act(async () => {
      const { purchases: privateRows, ...publicData } = s;
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            ...publicData,
            purchases: privateRows.map(
              ({ id, operation_id, note, created_at, updated_at, ...p }) => p,
            ),
          },
          null,
          2,
        ),
      );
      msg("Dados copiados, sem IDs de operação ou observações privadas.");
    }),
  );
  document.querySelector("#save-content")?.addEventListener("click", () =>
    act(async () => {
      const saved = await api("contents", "POST", {
        type: s.type,
        start: s.start,
        end: s.end,
        quoteId: s.quote.id,
      });
      snapshot = saved.snapshot;
      await refresh();
      await preview(saved.snapshot, true);
      msg("Versão arquivada com os números recalculados e preservados.");
    }),
  );
}
function archive() {
  el().innerHTML = `<section class="panel"><h2>Conteúdos preservados</h2><p>Os números de cada versão ficam congelados. Marque as redes em que você já publicou.</p>${
    data.contents.length
      ? data.contents
          .map((c) => {
            const channels = JSON.parse(c.channels_json);
            return `<article class="archive-item"><div><h3>${esc(c.title)}</h3><small>Criado em ${localTime(c.created_at)}</small></div><div class="channels">${["instagram", "threads", "youtube"].map((k) => `<label><input type="checkbox" data-content="${c.id}" data-channel="${k}" ${channels[k] ? "checked" : ""}>${k === "youtube" ? "YouTube/Shorts" : k}</label>`).join("")}</div><button data-open="${c.id}">Abrir versão</button></article>`;
          })
          .join("")
      : empty(
          "Seu arquivo de conteúdo.",
          "Prepare uma arte e clique em “Arquivar versão” para guardá-la aqui.",
        )
  }</section><div id="preview"></div>`;
  document.querySelectorAll<HTMLInputElement>("[data-channel]").forEach(
    (b) =>
      (b.onchange = () =>
        void act(async () => {
          const channels = Object.fromEntries(
            [
              ...document.querySelectorAll<HTMLInputElement>(
                `[data-content="${b.dataset.content}"]`,
              ),
            ].map((v) => [v.dataset.channel, v.checked]),
          );
          try {
            await api("contents/" + b.dataset.content, "PUT", channels);
            await refresh();
            msg("Status de publicação atualizado.");
          } catch (e) {
            b.checked = !b.checked;
            throw e;
          }
        })),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-open]").forEach(
    (b) =>
      (b.onclick = () =>
        void act(async () => {
          const c = await api("contents/" + b.dataset.open);
          await preview(JSON.parse(c.snapshot_json), true);
        })),
  );
}
void (async () => {
  try {
    await refresh();
    render();
  } catch {
    login();
  }
})();
