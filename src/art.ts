import { brl, btc, pct, localTime, type Snapshot } from "./domain";
export async function renderArt(s: Snapshot): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext("2d")!;
  const bg = c.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#141618");
  bg.addColorStop(1, "#090b0c");
  c.fillStyle = bg;
  c.fillRect(0, 0, 1080, 1350);
  const glow = c.createRadialGradient(940, 130, 0, 940, 130, 600);
  glow.addColorStop(0, "#ff950026");
  glow.addColorStop(1, "#ff950000");
  c.fillStyle = glow;
  c.fillRect(0, 0, 1080, 750);
  function text(
    t: string,
    x: number,
    y: number,
    size = 24,
    color = "#f7f5ef",
    align: CanvasTextAlign = "left",
    weight = 500,
    max = 980,
  ) {
    c.fillStyle = color;
    c.font = `${weight} ${size}px Arial, sans-serif`;
    c.textAlign = align;
    while (c.measureText(t).width > max && size > 12) {
      size--;
      c.font = `${weight} ${size}px Arial, sans-serif`;
    }
    c.fillText(t, x, y);
  }
  function box(x: number, y: number, w: number, h: number) {
    c.fillStyle = "#111315";
    c.strokeStyle = "#373a3d";
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(x, y, w, h, 20);
    c.fill();
    c.stroke();
  }
  function line(y: number) {
    c.strokeStyle = "#34373a";
    c.beginPath();
    c.moveTo(76, y);
    c.lineTo(1004, y);
    c.stroke();
  }
  text("1", 385, 90, 76, "#fff", "center", 900);
  c.fillStyle = "#ff9c26";
  c.beginPath();
  c.arc(434, 62, 36, 0, Math.PI * 2);
  c.fill();
  text("₿", 434, 81, 53, "#fff", "center", 800);
  text("DEZ EM", 490, 52, 31, "#fff", "left", 800);
  text("BITCOIN", 490, 86, 31, "#fff", "left", 800);
  text(
    "DISCIPLINA HOJE. UM DIA DE CADA VEZ.",
    540,
    129,
    16,
    "#a0a3a5",
    "center",
    500,
  );
  text(
    s.title,
    540,
    248,
    s.type === "daily" ? 112 : 72,
    "#ffa027",
    "center",
    900,
    970,
  );
  const date =
    s.start === s.end
      ? s.end.split("-").reverse().join("/")
      : s.start.split("-").reverse().join("/") +
        " A " +
        s.end.split("-").reverse().join("/");
  text(date, 540, 300, 28, "#eee", "center", 700);
  c.fillStyle = "#ff9c26";
  c.beginPath();
  c.roundRect(225, 326, 630, 56, 28);
  c.fill();
  text(
    `${brl(s.periodContribution)} EM BITCOIN ${s.type === "daily" ? "HOJE" : "NO PERÍODO"}`,
    540,
    363,
    25,
    "#101214",
    "center",
    800,
    600,
  );
  box(40, 410, 1000, 345);
  text("VALOR DA CARTEIRA NO CORTE", 540, 464, 24, "#afb1b4", "center", 700);
  text(brl(s.value), 540, 593, 116, "#fff", "center", 900, 920);
  line(631);
  text("TOTAL APORTADO", 290, 673, 20, "#a9adb1", "center", 600);
  text(brl(s.contributed), 290, 724, 44, "#fff", "center", 800, 430);
  text("RESULTADO ACUMULADO", 790, 673, 20, "#a9adb1", "center", 600);
  text(
    `${Number(s.result) > 0 ? "+" : ""}${brl(s.result)} (${pct(s.percent)})`,
    790,
    724,
    39,
    Number(s.result) < 0 ? "#ff7279" : "#61d6a4",
    "center",
    800,
    450,
  );
  box(40, 777, 1000, 310);
  text(
    s.type === "daily" ? "COMPRA DO DIA" : "NÚMEROS DO PERÍODO",
    540,
    826,
    26,
    "#ffa027",
    "center",
    800,
  );
  const rows =
    s.type === "daily"
      ? [
          ["BTC recebido", `${btc(s.periodSats)} BTC`],
          [
            "Preço de compra",
            s.purchases.length === 1
              ? `${brl(s.purchases[0].price)}/BTC`
              : `${s.buys} compras no dia`,
          ],
          ["Taxas das compras", `≈ ${brl(s.periodFees)}`],
          ["BTC acumulado", `${btc(s.sats)} BTC`],
        ]
      : [
          ["Compras registradas", String(s.buys)],
          ["BTC recebido", `${btc(s.periodSats)} BTC`],
          ["Taxas das compras", `≈ ${brl(s.periodFees)}`],
          [
            "Resultado no período",
            s.periodResult === null
              ? "Sem cotação inicial"
              : brl(s.periodResult),
          ],
        ];
  rows.forEach(([k, v], i) => {
    const y = 878 + i * 53;
    text(k, 88, y, 25, "#b6b9bc");
    text(v, 990, y, 27, "#fff", "right", 700, 550);
    if (i < 3) line(y + 17);
  });
  box(40, 1105, 1000, 205);
  text(
    `Cotação: ${brl(s.quote.price)}/BTC · Bitpreço / last`,
    540,
    1145,
    21,
    "#eee",
    "center",
    600,
  );
  text(
    `${localTime(s.asOf)} (Brasília) · ${s.quote.kind === "close" ? "Fechamento" : "Posição no horário"}`,
    540,
    1180,
    20,
    "#b8bbbf",
    "center",
  );
  text(
    "Valor estimado antes de custos de venda.",
    540,
    1210,
    19,
    "#b8bbbf",
    "center",
  );
  if (s.missingDays.length)
    text(
      `${s.missingDays.length} dia(s) sem compra cadastrada no período.`,
      540,
      1238,
      18,
      "#ffcc83",
      "center",
    );
  else if (s.warnings.some((w) => w.includes("posteriores")))
    text(
      "Compras após o corte não estão incluídas.",
      540,
      1238,
      18,
      "#ffcc83",
      "center",
    );
  text("Dez por dia, rumo ao milhão.", 540, 1280, 25, "#ffa027", "center", 800);
  return canvas;
}
export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function downloadArt(s: Snapshot) {
  const canvas = await renderArt(s);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `dez-em-bitcoin-${s.type}-${s.end}.png`);
  }, "image/png");
}
