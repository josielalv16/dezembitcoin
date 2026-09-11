import { readFileSync } from "node:fs";
import { createServer } from "vite";
if (!process.argv[2])
  throw new Error(
    "Uso: node scripts/validate-radar.mjs caminho-do-arquivo.json",
  );
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { parseRadarPackage } = await server.ssrLoadModule(
    "/src/radar-import.ts",
  );
  const pack = parseRadarPackage(
    JSON.parse(readFileSync(process.argv[2], "utf8")),
  );
  console.log(
    `Radar válido: ${pack.weekStart} a ${pack.weekEnd}, ${pack.stories.length} notícias, ${pack.stories.map((s) => s.pages.length).join("/")} páginas. Validação estrutural; fatos e fontes exigem revisão.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
