import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilder } from "./.aspire/modules/aspire.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instanceDir = path.join(root, "instances", "traceless");
loadDotEnv(path.join(root, ".env"));

const builder = await createBuilder();

const postgres = await builder.addPostgres("postgres");
await postgres.withDataVolume();
const db = await postgres.addDatabase("guildhub");

const liveBattleNet = shouldUseLiveBattleNet();
const clientId = liveBattleNet ? requiredEnv("BATTLENET_CLIENT_ID") : "local";
const clientSecret = liveBattleNet
  ? requiredEnv("BATTLENET_CLIENT_SECRET")
  : "local";
const sessionSecret =
  process.env.SESSION_SECRET !== undefined &&
  process.env.SESSION_SECRET.length >= 32
    ? process.env.SESSION_SECRET
    : "local-session-secret-not-real-000000";
const redirectUri =
  process.env.BATTLENET_REDIRECT_URI ?? "http://127.0.0.1:3000/auth/callback";

const migrate = await builder
  .addNodeApp("migrate", path.join(root, "apps", "api"), "src/migrate.ts")
  .withPnpm()
  .withRunScript("dev:migrate")
  .withReference(db)
  .withEnvironment("DATABASE_URL", db)
  .withEnvironment("INSTANCE_DIR", instanceDir)
  .withEnvironment("BATTLENET_CLIENT_ID", clientId)
  .withEnvironment("BATTLENET_CLIENT_SECRET", clientSecret)
  .withEnvironment("BATTLENET_REDIRECT_URI", redirectUri)
  .withEnvironment("SESSION_SECRET", sessionSecret)
  .waitFor(db);

const assetRoot = path.join(root, "apps", "model-baker", "assets", "fixed");
const bakerCache = path.join(root, "apps", "model-baker", "cache");

const api = await builder
  .addNodeApp("api", path.join(root, "apps", "api"), "src/index.ts")
  .withPnpm()
  .withRunScript("dev")
  .withHttpEndpoint({ env: "PORT" })
  .withHttpHealthCheck({ path: "/health/ready" })
  .withReference(db)
  .withEnvironment("DATABASE_URL", db)
  .withEnvironment("INSTANCE_DIR", instanceDir)
  .withEnvironment("BATTLENET_CLIENT_ID", clientId)
  .withEnvironment("BATTLENET_CLIENT_SECRET", clientSecret)
  .withEnvironment("SESSION_SECRET", sessionSecret)
  .withEnvironment("BATTLENET_REDIRECT_URI", redirectUri)
  .withEnvironment("ASSET_ROOT", assetRoot)
  .waitForCompletion(migrate);

if (!liveBattleNet) {
  const battlenet = await builder
    .addNodeApp(
      "battlenet-stub",
      path.join(root, "apps", "battlenet-stub"),
      "src/main.ts",
    )
    .withPnpm()
    .withRunScript("dev")
    .withHttpEndpoint({ env: "PORT" });
  await api.withReference(battlenet);
  const stubEndpoint = await battlenet.getEndpoint("http");
  await api.withEnvironment("BATTLENET_API_BASE_URL", stubEndpoint);
} else {
  await api.withEnvironment("BATTLENET_API_BASE_URL", "");
}

const web = await builder
  .addViteApp("web", path.join(root, "apps", "web"))
  .withPnpm()
  .withReference(api)
  .waitFor(api);

if (existsSync(assetRoot)) {
  await web.withEnvironment("GUILDHUB_ASSET_ROOT", assetRoot);
}

const bakerDllRelease = path.join(
  root,
  "apps",
  "model-baker",
  "src",
  "GuildHub.ModelBaker.Cli",
  "bin",
  "Release",
  "net10.0",
  "GuildHub.ModelBaker.Cli.dll",
);
const bakerDllDebug = path.join(
  root,
  "apps",
  "model-baker",
  "src",
  "GuildHub.ModelBaker.Cli",
  "bin",
  "Debug",
  "net10.0",
  "GuildHub.ModelBaker.Cli.dll",
);
const bakerDll = existsSync(bakerDllRelease) ? bakerDllRelease : bakerDllDebug;
if (existsSync(bakerDll)) {
  await builder
    .addNodeApp("worker", path.join(root, "apps", "api"), "src/worker.ts")
    .withPnpm()
    .withRunScript("dev:worker")
    .withReference(db)
    .withEnvironment("DATABASE_URL", db)
    .withEnvironment("INSTANCE_DIR", instanceDir)
    .withEnvironment("BATTLENET_CLIENT_ID", clientId)
    .withEnvironment("BATTLENET_CLIENT_SECRET", clientSecret)
    .withEnvironment("SESSION_SECRET", sessionSecret)
    .withEnvironment("BATTLENET_REDIRECT_URI", redirectUri)
    .withEnvironment("ASSET_ROOT", assetRoot)
    .withEnvironment("BAKER_CACHE", bakerCache)
    .withEnvironment("BAKER_CLI", bakerDll)
    .waitForCompletion(migrate);
}

await builder.build().run();

function shouldUseLiveBattleNet(): boolean {
  if (process.env.BATTLENET_USE_STUB === "1") return false;
  const clientId = process.env.BATTLENET_CLIENT_ID;
  const clientSecret = process.env.BATTLENET_CLIENT_SECRET;
  return (
    typeof clientId === "string" &&
    clientId.length > 0 &&
    clientId !== "local" &&
    typeof clientSecret === "string" &&
    clientSecret.length > 0 &&
    clientSecret !== "local"
  );
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing environment: ${key}`);
  }
  return value;
}

function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key.length === 0 || process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
