import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { makeBattleNetGuildSource } from "./battle-net-guild-source.js";
import { createBattleNetClient } from "../../../platform/blizzard/client.js";

const profile = {
  id: 1,
  name: "Example Guild",
  slug: "example-guild",
  faction: { type: "ALLIANCE", name: "Alliance" },
  achievement_points: 0,
  member_count: 2,
};

const roster = {
  members: [
    {
      rank: 0,
      character: {
        id: 101,
        name: "Guildmaster",
        surname: "Example",
        level: 80,
        playable_class: { id: 1 },
        playable_race: { id: 1 },
      },
    },
  ],
};

let server: ReturnType<typeof serve> | undefined;

async function startStub(fail?: "503" | "429" | "404"): Promise<string> {
  const app = new Hono();
  app.use("*", async (context, next) => {
    const path = new URL(context.req.url).pathname;
    const isToken = path === "/token" || path === "/oauth/token";
    if (!isToken && fail === "503") {
      return context.json({ error: "unavailable" }, 503);
    }
    if (!isToken && fail === "429") {
      context.header("Retry-After", "2");
      return context.json({ error: "rate" }, 429);
    }
    if (!isToken && fail === "404") {
      return context.json({ error: "missing" }, 404);
    }
    await next();
    return;
  });
  app.post("/token", (context) =>
    context.json({
      access_token: "stub-access-token",
      token_type: "bearer",
      expires_in: 3600,
    }),
  );
  app.get("/data/wow/guild/:slug", (context) => context.json(profile));
  app.get("/data/wow/guild/:slug/roster", (context) => context.json(roster));

  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => {
    server?.once("listening", () => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("stub did not bind a port");
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe("Battle.net guild source", () => {
  it("maps a guild profile and roster from the official client", async () => {
    const baseUrl = await startStub();
    const client = await createBattleNetClient({
      key: "local",
      secret: "local",
      origin: "eu",
      apiBaseUrl: baseUrl,
    });
    const source = makeBattleNetGuildSource(client);
    const guild = { slug: "example-guild" };

    const profileResult = await source.fetchProfile(guild);
    expect(profileResult).toEqual({
      ok: true,
      value: {
        id: "1",
        slug: "example-guild",
        name: "Example Guild",
        faction: "ALLIANCE",
        achievementPoints: 0,
        memberCount: 2,
      },
    });

    const rosterResult = await source.fetchRoster(guild);
    expect(rosterResult.ok && rosterResult.value[0]).toMatchObject({
      characterId: "101",
      rankId: 0,
      slug: "guildmaster-example",
    });
  });

  it("maps a missing guild to guild.not_found", async () => {
    const baseUrl = await startStub("404");
    const source = makeBattleNetGuildSource(
      await createBattleNetClient({
        key: "local",
        secret: "local",
        origin: "eu",
        apiBaseUrl: baseUrl,
      }),
    );
    const result = await source.fetchProfile({ slug: "missing" });
    expect(result).toEqual({ ok: false, error: { code: "guild.not_found" } });
  });

  it("maps 503 to upstream.unavailable", async () => {
    const baseUrl = await startStub("503");
    const source = makeBattleNetGuildSource(
      await createBattleNetClient({
        key: "local",
        secret: "local",
        origin: "eu",
        apiBaseUrl: baseUrl,
      }),
    );
    const result = await source.fetchRoster({ slug: "example-guild" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("upstream.unavailable");
  });
});
