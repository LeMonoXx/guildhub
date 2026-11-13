import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilder } from "./.aspire/modules/aspire.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instanceDir = path.join(root, "instances", "traceless");

const builder = await createBuilder();

const postgres = await builder.addPostgres("postgres");
await postgres.withDataVolume();
const db = await postgres.addDatabase("guildhub");

const battlenet = await builder
  .addNodeApp(
    "battlenet-stub",
    path.join(root, "apps", "battlenet-stub"),
    "src/main.ts",
  )
  .withPnpm()
  .withRunScript("dev")
  .withHttpEndpoint({ env: "PORT" });

const migrate = await builder
  .addNodeApp("migrate", path.join(root, "apps", "api"), "src/migrate.ts")
  .withPnpm()
  .withRunScript("dev:migrate")
  .withReference(db)
  .withEnvironment("DATABASE_URL", db)
  .withEnvironment("INSTANCE_DIR", instanceDir)
  .withEnvironment("BATTLENET_CLIENT_ID", "local")
  .withEnvironment("BATTLENET_CLIENT_SECRET", "local")
  .withEnvironment(
    "BATTLENET_REDIRECT_URI",
    "http://127.0.0.1:3000/auth/callback",
  )
  .withEnvironment("SESSION_SECRET", "local-session-secret-not-real-000000")
  .waitFor(db);

const api = await builder
  .addNodeApp("api", path.join(root, "apps", "api"), "src/index.ts")
  .withPnpm()
  .withRunScript("dev")
  .withHttpEndpoint({ env: "PORT" })
  .withHttpHealthCheck({ path: "/health/ready" })
  .withReference(db)
  .withReference(battlenet)
  .withEnvironment("DATABASE_URL", db)
  .withEnvironment("INSTANCE_DIR", instanceDir)
  .withEnvironment("BATTLENET_CLIENT_ID", "local")
  .withEnvironment("BATTLENET_CLIENT_SECRET", "local")
  .withEnvironment("SESSION_SECRET", "local-session-secret-not-real-000000")
  .waitForCompletion(migrate);

const stubEndpoint = await battlenet.getEndpoint("http");
await api.withEnvironment("BATTLENET_API_BASE_URL", stubEndpoint);
await api.withEnvironment(
  "BATTLENET_REDIRECT_URI",
  "http://127.0.0.1:3000/auth/callback",
);

await builder.build().run();
