import { zipSync, strToU8 } from "fflate";
import { renderArt, downloadBlob } from "./art";
import { brl } from "./domain";
import type { EditorialSnapshot, Slide } from "./editorial-domain";
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      if (ctx.measureText(word).width > width) {
        if (line) result.push(line);
        line = "";
        for (const char of word) {
          if (ctx.measureText(line + char).width > width) {
            result.push(line);
            line = "";
          }
          line += char;
        }
      } else if (
        ctx.measureText(line + (line ? " " : "") + word).width > width
      ) {
        result.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    result.push(line);
  }
  return result;
}
function block(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  maxSize: number,
  color: string,
  bold = false,
) {
  let size = maxSize,
    wrapped: string[] = [];
  while (size >= 16) {
    ctx.font = `${bold ? 800 : 500} ${size}px Arial`;
    wrapped = lines(ctx, text, width);
    if (wrapped.length * size * 1.4 <= height) break;
    size--;
  }
  if (size < 16)
    throw new Error(
      "Texto muito longo para a arte. Divida em mais páginas antes de exportar.",
    );
  ctx.fillStyle = color;
  wrapped.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.4));
}
export async function renderEditorial(
  snapshot: EditorialSnapshot,
): Promise<HTMLCanvasElement[]> {
  if (snapshot.kind === "daily" && snapshot.financial)
    return [await renderArt(snapshot.financial)];
  return snapshot.pages.map((page, index) => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1350;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0b0d11";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#ff9b26";
    ctx.fillRect(64, 65, 8, 62);
    block(ctx, "DEZ EM BITCOIN", 96, 99, 760, 55, 32, "#f6f4ee", true);
    block(ctx, "₿", 930, 107, 100, 90, 60, "#ff9b26", true);
    block(ctx, page.label, 70, 198, 940, 60, 24, "#ffac48", true);
    block(ctx, page.title, 70, 285, 940, 260, 70, "#ffffff", true);
    block(
      ctx,
      page.body,
      70,
      575,
      940,
      page.chart?.length ? 160 : 430,
      page.chart?.length ? 26 : 40,
      "#dce0e9",
    );
    if (page.chart?.length) drawChart(ctx, page.chart, page.chartMode);
    if (page.source) block(ctx, page.source, 70, 1060, 940, 130, 21, "#9eabbc");
    ctx.fillStyle = "#343a43";
    ctx.fillRect(70, 1210, 940, 2);
    block(
      ctx,
      `${snapshot.end.split("-").reverse().join("/")}  •  ${index + 1}/${snapshot.pages.length}`,
      70,
      1257,
      550,
      45,
      23,
      "#9eabbc",
    );
    block(
      ctx,
      "Dez por dia, rumo ao milhão.",
      580,
      1257,
      440,
      45,
      24,
      "#ffac48",
      true,
    );
    return c;
  });
}
function drawChart(
  ctx: CanvasRenderingContext2D,
  points: NonNullable<Slide["chart"]>,
  mode?: "average",
) {
  const values = points.flatMap((p) =>
    mode === "average" ? [p.value] : [p.cost, p.value, p.value - p.cost],
  );
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values);
  const x0 = 90,
    y0 = 1010,
    width = 900,
    height = 250;
  ctx.fillStyle = "#9eabbc";
  ctx.font = "21px Arial";
  ctx.fillText(
    mode === "average"
      ? "● Custo por BTC líquido (R$/BTC)"
      : "● Carteira   ■ Aportes   ◆ Resultado acumulado",
    90,
    726,
  );
  const y = (value: number) => y0 - ((value - min) / (max - min)) * height;
  ctx.strokeStyle = "#333c49";
  ctx.beginPath();
  ctx.moveTo(90, y(0));
  ctx.lineTo(990, y(0));
  ctx.stroke();
  for (const p of points) {
    const x =
      x0 +
      ((Date.parse(p.label) - Date.parse(points[0].label)) /
        Math.max(
          86400000,
          Date.parse(points.at(-1)!.label) - Date.parse(points[0].label),
        )) *
        width;
    if (mode !== "average") {
      ctx.fillStyle = "#67778f";
      ctx.fillRect(x - 4, y(p.cost) - 4, 8, 8);
      ctx.fillStyle = "#75d5b4";
      ctx.beginPath();
      ctx.moveTo(x, y(p.value - p.cost) - 6);
      ctx.lineTo(x + 6, y(p.value - p.cost));
      ctx.lineTo(x, y(p.value - p.cost) + 6);
      ctx.lineTo(x - 6, y(p.value - p.cost));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff9b26";
    ctx.beginPath();
    ctx.arc(x, y(p.value), 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#9eabbc";
  ctx.fillText(brl(max), 90, 755);
  ctx.fillText(brl(min), 90, 1000);
  ctx.fillText(points[0].label, 90, 1045);
  ctx.fillText(points.at(-1)!.label, 835, 1045);
}
export async function exportEditorial(
  snapshot: EditorialSnapshot,
  canvases: HTMLCanvasElement[],
) {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvases[i].toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG."))),
        "image/png",
      ),
    );
    files[`${String(i + 1).padStart(2, "0")}.png`] = new Uint8Array(
      await blob.arrayBuffer(),
    );
  }
  files["legendas.txt"] = strToU8(
    Object.entries(snapshot.captions)
      .map(([k, v]) => `${k.toUpperCase()}\n${v}`)
      .join("\n\n"),
  );
  files["texto-alternativo.txt"] = strToU8(
    snapshot.pages
      .map(
        (p, i) =>
          `${i + 1}. ${p.title}. ${p.body}${p.source ? " Fonte: " + p.source : ""}`,
      )
      .join("\n\n"),
  );
  files["snapshot.json"] = strToU8(JSON.stringify(snapshot, null, 2));
  files["prompt-ia.txt"] = strToU8(snapshot.prompt);
  downloadBlob(
    new Blob([zipSync(files, { level: 0 }) as BlobPart], {
      type: "application/zip",
    }),
    `dez-${snapshot.kind}-${snapshot.end}.zip`,
  );
}
