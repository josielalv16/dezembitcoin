import {
  BUFFER_SERVICES,
  DELIVERY_LABELS,
  type BufferService,
  type Delivery,
} from "./buffer-domain";
import { renderEditorial } from "./editorial-art";
import type { EditorialSnapshot } from "./editorial-domain";
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const names = { instagram: "Instagram", threads: "Threads", tiktok: "TikTok" };
function link(url: string) {
  try {
    return new URL(url).protocol === "https:" ? escape(url) : "";
  } catch {
    return "";
  }
}
export async function mountBuffer(
  root: HTMLElement,
  api: Api,
  notify: (s: string, error?: boolean) => void,
) {
  const status = await api("buffer/status");
  if (!root.isConnected) return;
  root.innerHTML = `<section class="panel"><h2>Conectar ao Buffer</h2><p>Instagram, Threads e TikTok. YouTube fora da automação por enquanto.</p><p>Chave da API: <strong>${status.keyConfigured ? "configurada" : "pendente"}</strong> · Armazenamento: <strong>${status.storageConfigured ? "configurado" : "pendente"}</strong></p><p class="hint">Configure o segredo BUFFER_API_KEY no Worker e o bucket R2 conforme DEPLOY-BUFFER.md. A chave nunca é enviada para esta tela.</p><button id="buffer-discover" ${status.keyConfigured ? "" : "disabled"}>Buscar perfis conectados</button><div id="buffer-profiles"></div><h3>Perfis selecionados</h3>${status.mappings.length ? status.mappings.map((m: any) => `<p>${escape(m.service)} · ${escape(m.name)}</p>`).join("") : "<p>Nenhum perfil selecionado.</p>"}<p>Gere e revise um conteúdo no Calendário. Depois use “Preparar envio ao Buffer” e aprove a publicação ou o agendamento.</p><a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer">Abrir Buffer</a></section>`;
  const button = root.querySelector<HTMLButtonElement>("#buffer-discover")!;
  button.onclick = async () => {
    button.disabled = true;
    try {
      const { channels } = await api("buffer/discover", "POST", {});
      const area = root.querySelector<HTMLElement>("#buffer-profiles")!;
      area.innerHTML = `<form id="buffer-mapping">${BUFFER_SERVICES.map(
        (service) =>
          `<label>${names[service]}<select name="${service}"><option value="">Não conectar</option>${channels
            .filter((c: any) => c.service === service)
            .map(
              (c: any) =>
                `<option value="${escape(c.id)}" ${status.mappings.some((m: any) => m.channel_id === c.id) ? "selected" : ""} ${c.isDisconnected || c.isLocked ? "disabled" : ""}>${escape(c.displayName || c.name)}${c.isDisconnected ? " · desconectado" : ""}${c.isLocked ? " · bloqueado" : ""}${c.isQueuePaused ? " · fila pausada" : ""}</option>`,
            )
            .join("")}</select></label>`,
      ).join("")}<button>Salvar perfis selecionados</button></form>`;
      area.querySelector<HTMLFormElement>("form")!.onsubmit = async (event) => {
        event.preventDefault();
        const save = area.querySelector<HTMLButtonElement>("button")!;
        save.disabled = true;
        try {
          const form = new FormData(event.target as HTMLFormElement);
          const mappings = BUFFER_SERVICES.flatMap((service) => {
            const c = channels.find(
              (c: any) => c.id === form.get(service) && c.service === service,
            );
            return c
              ? [{ service, channelId: c.id, organizationId: c.organizationId }]
              : [];
          });
          if (!mappings.length)
            throw new Error("Selecione pelo menos um perfil.");
          await api("buffer/channels", "POST", mappings);
          notify("Perfis conectados ao sistema.");
          await mountBuffer(root, api, notify);
        } catch (error) {
          notify((error as Error).message, true);
          save.disabled = false;
        }
      };
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      button.disabled = false;
    }
  };
}
export async function mountBufferSend(
  root: HTMLElement,
  api: Api,
  itemId: string,
  versionId: string,
  snapshot: EditorialSnapshot,
  reviewed: boolean,
  itemChannels: string[],
  reload: () => Promise<void>,
  publishedChannels: string[] = [],
) {
  const [configuration, result] = await Promise.all([
    api("buffer/status"),
    api("buffer/deliveries?item=" + encodeURIComponent(itemId)),
  ]);
  if (!root.isConnected) return;
  const deliveries = result.deliveries as Delivery[];
  const active = (service: string) =>
    deliveries.find(
      (d) =>
        d.service === service && !["rejected", "cancelled"].includes(d.status),
    );
  const available = BUFFER_SERVICES.filter(
    (service) =>
      itemChannels.includes(service) &&
      !publishedChannels.includes(service) &&
      configuration.mappings.some((m: any) => m.service === service) &&
      !active(service),
  );
  root.innerHTML = `<h3>Publicação pelo Buffer</h3><p>Imagens no Instagram/Threads e vídeo vertical no TikTok. Você confere e aprova antes de enviar.</p><div>${deliveries.map((d) => `<article class="archive-item"><div><strong>${escape(names[d.service])}: ${escape(DELIVERY_LABELS[d.status] ?? d.status)}</strong><p>${escape(d.error)}</p>${d.due_at ? `<small>Horário: ${escape(new Date(d.due_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))} (Brasília)</small>` : ""}${d.url && link(d.url) ? `<p><a href="${link(d.url)}" target="_blank" rel="noopener noreferrer">Ver publicação</a></p>` : ""}<small>Registro: ${escape(d.id)}${d.post_id ? ` · Buffer: ${escape(d.post_id)}` : ""}</small>${d.post_id && ["scheduled", "error", "draft", "needs_approval"].includes(d.status) ? `<label class="check"><input type="checkbox" data-cancel-check="${escape(d.id)}">Quero cancelar este envio no Buffer</label><button type="button" data-cancel="${escape(d.id)}">Cancelar agendamento</button>` : ""}${d.status === "uncertain" ? `<p>Confira a fila e os publicados no Buffer. Não envie novamente sem verificar.</p><button type="button" data-reconcile="${escape(d.id)}">Resolver resultado incerto</button>` : ""}</div></article>`).join("")}</div><button type="button" id="buffer-sync">Atualizar status</button><a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer">Abrir Buffer</a><p class="hint">Consultas ao Buffer no máximo uma vez por hora por envio. Posts agendados só serão confirmados depois da publicação.</p><div id="buffer-compose"></div><p role="status" id="buffer-message"></p>`;
  const message = root.querySelector<HTMLElement>("#buffer-message")!;
  root.querySelector<HTMLButtonElement>("#buffer-sync")!.onclick = async () => {
    try {
      await api("buffer/sync", "POST", { itemId });
      await reload();
    } catch (error) {
      message.textContent = (error as Error).message;
    }
  };
  root.querySelectorAll<HTMLButtonElement>("[data-cancel]").forEach(
    (button) =>
      (button.onclick = async () => {
        if (
          !root.querySelector<HTMLInputElement>(
            `[data-cancel-check="${button.dataset.cancel}"]`,
          )!.checked
        ) {
          message.textContent = "Marque a confirmação de cancelamento.";
          return;
        }
        button.disabled = true;
        try {
          await api("buffer/cancel", "POST", {
            id: button.dataset.cancel,
            confirmed: true,
          });
          await reload();
        } catch (error) {
          message.textContent = (error as Error).message;
          button.disabled = false;
        }
      }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-reconcile]").forEach(
    (button) =>
      (button.onclick = () => {
        const box = document.createElement("div");
        box.innerHTML = `<label>ID do post encontrado no Buffer<input data-remote-id></label><label class="check"><input type="checkbox" data-no-post>Conferi a fila e os publicados no Buffer e confirmo que nenhum post foi criado por este envio.</label><button type="button">Salvar conferência</button>`;
        button.replaceWith(box);
        box.querySelector("button")!.onclick = async () => {
          try {
            await api("buffer/reconcile", "POST", {
              id: button.dataset.reconcile,
              postId:
                box
                  .querySelector<HTMLInputElement>("[data-remote-id]")!
                  .value.trim() || undefined,
              noPostConfirmed:
                box.querySelector<HTMLInputElement>("[data-no-post]")!.checked,
            });
            await reload();
          } catch (error) {
            message.textContent = (error as Error).message;
          }
        };
      }),
  );
  const area = root.querySelector<HTMLElement>("#buffer-compose")!;
  if (
    !configuration.keyConfigured ||
    !configuration.storageConfigured ||
    !configuration.mappings.length
  ) {
    area.innerHTML =
      "<p>Configure a integração na tela Buffer antes de enviar.</p>";
    return;
  }
  if (!reviewed) {
    area.innerHTML =
      "<p>Confirme a revisão da versão atual para habilitar o envio.</p>";
    return;
  }
  if (!available.length) {
    area.innerHTML =
      "<p>As redes conectadas deste conteúdo já têm um envio. Acompanhe os registros acima.</p>";
    return;
  }
  area.innerHTML = `<fieldset id="buffer-options"><legend>Materiais para aprovar</legend>${available.map((service) => `<label class="check"><input type="checkbox" data-send-service="${service}" checked>${names[service]} · ${escape(configuration.mappings.find((m: any) => m.service === service).name)}</label><label>Legenda — ${names[service]}<textarea data-send-text="${service}" rows="5" maxlength="${service === "threads" ? 500 : 2200}">${escape(service === "tiktok" ? (snapshot.captions.tiktok ?? snapshot.captions.instagram) : snapshot.captions[service])}</textarea></label>`).join("")}<label>Segundos por página do TikTok<input id="buffer-seconds" type="number" min="3" max="20" value="8"></label><label class="check"><input id="buffer-ai" type="checkbox">Sinalizar conteúdo gerado por IA no TikTok</label><label>Quando publicar<select id="buffer-mode"><option value="customScheduled">Agendar horário</option><option value="shareNow">Publicar agora</option></select></label><label>Data e hora (Brasília)<input id="buffer-due" type="datetime-local"></label><button type="button" id="buffer-prepare">Preparar envio ao Buffer</button></fieldset><div id="buffer-materials" class="art-pages"></div><label class="check"><input id="buffer-approved" type="checkbox" disabled>Conferi os materiais, as legendas, os perfis e o horário. Autorizo enviar às redes selecionadas.</label><button type="button" id="buffer-submit" disabled>Aprovar e enviar ao Buffer</button>`;
  const options = area.querySelector<HTMLFieldSetElement>("fieldset")!,
    prepare = area.querySelector<HTMLButtonElement>("#buffer-prepare")!,
    submit = area.querySelector<HTMLButtonElement>("#buffer-submit")!,
    approved = area.querySelector<HTMLInputElement>("#buffer-approved")!;
  let prepared: { images: Blob[]; video: Blob | null } | null = null;
  let urls: string[] = [];
  const clean = () => {
    urls.forEach(URL.revokeObjectURL);
    urls = [];
  };
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      clean();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const selected = () =>
    [
      ...area.querySelectorAll<HTMLInputElement>("[data-send-service]:checked"),
    ].map((el) => el.dataset.sendService as BufferService);
  options.addEventListener("input", (event) => {
    approved.checked = false;
    if (
      (event.target as HTMLElement).matches(
        "[data-send-service],#buffer-seconds",
      )
    ) {
      prepared = null;
      approved.disabled = true;
      submit.disabled = true;
      clean();
      area.querySelector("#buffer-materials")!.replaceChildren();
    }
  });
  area.querySelector<HTMLSelectElement>("#buffer-mode")!.onchange = () => {
    area.querySelector<HTMLInputElement>("#buffer-due")!.disabled =
      area.querySelector<HTMLSelectElement>("#buffer-mode")!.value ===
      "shareNow";
  };
  prepare.onclick = async () => {
    options.disabled = true;
    submit.disabled = true;
    approved.disabled = true;
    approved.checked = false;
    prepared = null;
    clean();
    try {
      const services = selected();
      if (!services.length) throw new Error("Selecione pelo menos uma rede.");
      message.textContent = "Preparando materiais para conferência…";
      const holder = area.querySelector("#buffer-materials")!;
      holder.replaceChildren();
      const images: Blob[] = [];
      if (services.some((s) => s !== "tiktok"))
        for (const canvas of await renderEditorial(snapshot, "feed")) {
          images.push(
            await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("Falha no PNG."))),
                "image/png",
              ),
            ),
          );
          holder.append(canvas);
        }
      let video: Blob | null = null;
      if (services.includes("tiktok")) {
        const { createShortsVideo } = await import("./video-encoder");
        video = await createShortsVideo(
          await renderEditorial(snapshot, "shorts"),
          Number(
            area.querySelector<HTMLInputElement>("#buffer-seconds")!.value,
          ),
          (percent) =>
            (message.textContent = `Gerando vídeo: ${percent}%. Mantenha a aba aberta.`),
        );
        const player = document.createElement("video");
        player.controls = true;
        player.style.width = "100%";
        player.src = URL.createObjectURL(video);
        urls.push(player.src);
        holder.append(player);
      }
      prepared = { images, video };
      approved.disabled = false;
      submit.disabled = false;
      message.textContent =
        "Materiais prontos. Confira a prévia e os textos antes de autorizar.";
    } catch (error) {
      message.textContent = (error as Error).message;
    } finally {
      options.disabled = false;
    }
  };
  submit.onclick = async () => {
    if (!prepared || !approved.checked) {
      message.textContent = "Prepare e aprove os materiais antes de enviar.";
      return;
    }
    const services = selected(),
      mode = area.querySelector<HTMLSelectElement>("#buffer-mode")!.value;
    const due = area.querySelector<HTMLInputElement>("#buffer-due")!.value;
    if (
      mode === "customScheduled" &&
      (!due ||
        Date.parse(due + ":00-03:00") < Date.now() + 120000 ||
        Date.parse(due + ":00-03:00") > Date.now() + 30 * 86400000)
    ) {
      message.textContent =
        "Agende entre 2 minutos e 30 dias a partir de agora.";
      return;
    }
    for (const service of services) {
      const text = area
        .querySelector<HTMLTextAreaElement>(`[data-send-text="${service}"]`)!
        .value.trim();
      if (!text || [...text].length > (service === "threads" ? 500 : 2200)) {
        message.textContent = `Confira o tamanho da legenda de ${names[service]}.`;
        return;
      }
    }
    options.disabled = true;
    submit.disabled = true;
    approved.disabled = true;
    try {
      message.textContent = "Enviando os arquivos aprovados…";
      const upload = async (blob: Blob) => {
        const response = await fetch(
          "/api/buffer/assets?version=" + encodeURIComponent(versionId),
          {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Falha ao armazenar arquivo.");
        return data.id as string;
      };
      const imageIds = [];
      for (const blob of prepared.images) imageIds.push(await upload(blob));
      const videoId = prepared.video ? await upload(prepared.video) : null;
      for (const service of services) {
        message.textContent = `Enviando para ${names[service]}…`;
        const response = await api("buffer/send", "POST", {
          requestId: crypto.randomUUID(),
          versionId,
          expectedChannelId: configuration.mappings.find(
            (m: any) => m.service === service,
          ).channel_id,
          service,
          text: area
            .querySelector<HTMLTextAreaElement>(
              `[data-send-text="${service}"]`,
            )!
            .value.trim(),
          assets: service === "tiktok" ? [videoId] : imageIds,
          mode,
          ...(mode === "customScheduled"
            ? { dueAt: new Date(due + ":00-03:00").toISOString() }
            : {}),
          approved: true,
          aiGenerated:
            area.querySelector<HTMLInputElement>("#buffer-ai")!.checked,
        });
        if (
          ["rejected", "uncertain", "sending"].includes(
            response.delivery.status,
          )
        )
          throw new Error(
            response.delivery.error ||
              "Envio ainda sem confirmação. Atualize os status antes de continuar.",
          );
      }
      clean();
      await reload();
    } catch (error) {
      // Reload the persisted outcomes before another attempt, including partial success.
      message.textContent =
        (error as Error).message +
        " Feche e abra o conteúdo para conferir os envios registrados antes de tentar novamente.";
    }
  };
}
