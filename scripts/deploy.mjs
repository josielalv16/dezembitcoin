import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// Wrangler accepts JSONC, while Node's JSON.parse accepts JSON only. Remove
// comments and trailing commas before creating the deployment-specific config.
const jsonc = readFileSync("wrangler.jsonc", "utf8")
  .replace(/\/\/.*$/gm, "")
  .replace(/,\s*([}\]])/g, "$1");
const config = JSON.parse(jsonc);
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
// Optional until the user enables R2. Existing features remain deployable without it.
if (process.env.R2_BUCKET_NAME) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(process.env.R2_BUCKET_NAME))
    throw new Error("R2_BUCKET_NAME inválido.");
  config.r2_buckets = [
    { binding: "MEDIA", bucket_name: process.env.R2_BUCKET_NAME },
  ];
} else delete config.r2_buckets;
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
