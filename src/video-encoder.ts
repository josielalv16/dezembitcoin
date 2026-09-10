import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  canEncodeVideo,
} from "mediabunny";

export async function createShortsVideo(
  pages: HTMLCanvasElement[],
  seconds: number,
  progress: (percent: number) => void,
): Promise<Blob> {
  if (!pages.length || pages.some((p) => p.width !== 1080 || p.height !== 1920))
    throw new Error("O vídeo precisa de páginas verticais 1080 × 1920.");
  if (
    !Number.isInteger(seconds) ||
    seconds < 3 ||
    seconds > 20 ||
    pages.length * seconds > 180
  )
    throw new Error(
      "Escolha de 3 a 20 segundos por página, com duração total de até 180 segundos.",
    );
  if (
    !(await canEncodeVideo("avc", {
      width: 1080,
      height: 1920,
      bitrate: 4_000_000,
    }))
  )
    throw new Error(
      "Este navegador não suporta a criação de MP4. Tente no Chrome ou Edge atualizado em um computador.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec: "avc", bitrate: 4_000_000 });
  output.addVideoTrack(source, { frameRate: 30 });
  try {
    await output.start();
    const framesPerPage = seconds * 30;
    const totalFrames = pages.length * framesPerPage;
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % framesPerPage === 0)
        ctx.drawImage(pages[Math.floor(frame / framesPerPage)], 0, 0);
      await source.add(frame / 30, 1 / 30);
      if (frame % 30 === 0) {
        progress(Math.floor((frame / totalFrames) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    source.close();
    await output.finalize();
    progress(100);
    return new Blob([output.target.buffer!], { type: "video/mp4" });
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  }
}
