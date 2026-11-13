import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { readEnv } from "./env.js";

const env = readEnv(process.env);
const app = createApp();

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT }, (info) => {
  console.log(`listening on ${String(info.port)}`);
});
