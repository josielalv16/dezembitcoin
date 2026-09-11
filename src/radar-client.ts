import { parseRadarPackage, type RadarPackage } from "./radar-import";
export function mountRadarImport(
  root: HTMLElement,
  api: (path: string, method?: string, body?: unknown) => Promise<any>,
  done: (month: string) => Promise<void>,
  notify: (s: string, error?: boolean) => void,
) {
  root.innerHTML = `<h3>Importar Radar preparado pelo Codex</h3><p>Selecione o arquivo semanal para criar até quatro conteúdos separados, com páginas e legendas prontas para revisão. A importação não publica nas redes.</p><label>Arquivo do Radar (.json)<input type="file" accept=".json,application/json"></label><div data-preview></div><button type="button" disabled>Importar carrosséis para revisão</button>`;
  const file = root.querySelector("input")!,
    button = root.querySelector("button")!,
    preview = root.querySelector<HTMLElement>("[data-preview]")!;
  let pack: RadarPackage | null = null;
  file.onchange = async () => {
    pack = null;
    button.disabled = true;
    preview.replaceChildren();
    try {
      const selected = file.files?.[0];
      if (!selected) return;
      if (selected.size > 60000)
        throw new Error("O arquivo deve ter até 60 KB.");
      pack = parseRadarPackage(JSON.parse(await selected.text()));
      const heading = document.createElement("p");
      heading.textContent = `Semana ${pack.weekStart} a ${pack.weekEnd} · pesquisa até ${new Date(pack.researchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
      preview.append(heading);
      for (const story of pack.stories) {
        const details = document.createElement("details"),
          summary = document.createElement("summary");
        summary.textContent = `${story.title} · ${story.pages.length} páginas`;
        details.append(summary);
        for (const page of story.pages) {
          const p = document.createElement("p");
          p.textContent = `${page.label} — ${page.title}\n${page.body}`;
          details.append(p);
        }
        preview.append(details);
      }
      if (pack.selectionNote) {
        const p = document.createElement("p");
        p.textContent = pack.selectionNote;
        preview.append(p);
      }
      button.disabled = false;
    } catch (error) {
      notify("Arquivo inválido: " + (error as Error).message, true);
    }
  };
  button.onclick = async () => {
    if (!pack) return;
    button.disabled = true;
    file.disabled = true;
    try {
      const result = await api("editorial/radar/import", "POST", pack);
      notify(
        `${result.created} carrosséis criados. ${result.skipped} já existentes foram preservados. Revise cada conteúdo antes de publicar.`,
      );
      await done(result.weekEnd.slice(0, 7));
    } catch (error) {
      notify((error as Error).message, true);
      button.disabled = false;
      file.disabled = false;
    }
  };
}
