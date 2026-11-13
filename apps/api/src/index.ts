import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { readEnv } from "./env.js";

const env = readEnv(process.env);
const app = createApp();

const server = serve(
  { fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT },
  (info) => {
    console.log(`listening on ${String(info.port)}`);
  },
);

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, closing`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
