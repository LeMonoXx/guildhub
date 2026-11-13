import { serve } from "@hono/node-server";
import { createStubApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const app = createStubApp();

serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, (info) => {
  console.log(
    JSON.stringify({
      level: 30,
      time: new Date().toISOString(),
      service: "guildhub-battlenet-stub",
      port: info.port,
      msg: "Battle.net stub listening",
    }),
  );
});
