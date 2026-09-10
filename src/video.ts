import { downloadBlob } from "./art";

export const videoControls = `<div class="form-actions"><label>Segundos por página<input data-video-seconds type="number" min="3" max="20" step="1" value="8"></label><button data-video-download>Baixar vídeo MP4</button></div><p class="hint" data-video-status role="status">Vídeo vertical 1080 × 1920, sem áudio. Todas as páginas em sequência.</p>`;

export function bindVideo(
  root: Element,
  render: () => Promise<HTMLCanvasElement[]>,
  filename: string,
) {
  const button = root.querySelector<HTMLButtonElement>(
    "[data-video-download]",
  )!;
  const input = root.querySelector<HTMLInputElement>("[data-video-seconds]")!;
  const status = root.querySelector<HTMLElement>("[data-video-status]")!;
  button.onclick = async () => {
    button.disabled = true;
    input.disabled = true;
    try {
      const seconds = Number(input.value);
      if (!Number.isInteger(seconds) || seconds < 3 || seconds > 20)
        throw new Error("Escolha de 3 a 20 segundos por página.");
      status.textContent = "Preparando páginas… Mantenha esta aba aberta.";
      const { createShortsVideo } = await import("./video-encoder");
      const blob = await createShortsVideo(
        await render(),
        seconds,
        (percent) => {
          status.textContent = `Gerando vídeo: ${percent}%. Mantenha esta aba aberta.`;
        },
      );
      downloadBlob(blob, `${filename}-shorts.mp4`);
      status.textContent = "Vídeo MP4 pronto. Download iniciado.";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o vídeo.";
    } finally {
      button.disabled = false;
      input.disabled = false;
    }
  };
}
