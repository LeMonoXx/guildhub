import { Hono, type Context } from "hono";
import { guildProfile, guildRoster } from "./fixtures.js";

export function createStubApp(): Hono {
  const app = new Hono();

  app.use("*", async (context, next) => {
    const fail = new URL(context.req.url).searchParams.get("fail");
    if (fail === "503") {
      return context.json({ code: "BLZBAPI000", type: "BLZINTERNAL" }, 503);
    }
    if (fail === "429") {
      context.header("Retry-After", "1");
      return context.json({ code: "BLZBAPI429", type: "BLZTOOMANY" }, 429);
    }
    await next();
    return;
  });

  app.post("/token", issueToken);
  app.post("/oauth/token", issueToken);

  app.get("/data/wow/guild/:guildSlug", (context) => {
    const guildSlug = context.req.param("guildSlug");
    return context.json({
      ...guildProfile,
      slug: guildSlug,
      _links: { self: { href: `/data/wow/guild/${guildSlug}` } },
    });
  });

  app.get("/data/wow/guild/:guildSlug/roster", (context) => {
    const guildSlug = context.req.param("guildSlug");
    return context.json({
      ...guildRoster,
      guild: { ...guildRoster.guild, slug: guildSlug },
      _links: { self: { href: `/data/wow/guild/${guildSlug}/roster` } },
    });
  });

  return app;
}

async function issueToken(context: Context): Promise<Response> {
  const grantType =
    context.req.query("grant_type") ?? (await bodyGrantType(context));
  if (grantType !== "client_credentials") {
    return context.json({ error: "unsupported_grant_type" }, 400);
  }
  return context.json({
    access_token: "stub-access-token",
    token_type: "bearer",
    expires_in: 3600,
  });
}

async function bodyGrantType(context: Context): Promise<string | undefined> {
  try {
    const body = await context.req.parseBody();
    return typeof body.grant_type === "string" ? body.grant_type : undefined;
  } catch {
    return undefined;
  }
}
