import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const id = process.env.D1_DATABASE_ID;
if (
  !id ||
  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
  id === config.d1_databases[0].database_id
) {
  throw new Error(
    "Defina D1_DATABASE_ID nas variáveis de build com o UUID do banco D1 criado no Cloudflare.",
  );
}
config.d1_databases[0].database_id = id;
writeFileSync("wrangler.generated.json", JSON.stringify(config, null, 2));
for (const args of [
  [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--config",
    "wrangler.generated.json",
  ],
  ["deploy", "--config", "wrangler.generated.json"],
]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
