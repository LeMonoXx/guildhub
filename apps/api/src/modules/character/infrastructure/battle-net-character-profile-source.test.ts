import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { createGuildBattleNetClient } from "../../guild/infrastructure/blizzard-api-client.js";
import { makeBattleNetCharacterProfileSource } from "./battle-net-character-profile-source.js";

const character = {
  characterId: "101",
  name: "Example",
  surname: "Realm",
  slug: "example-realm",
  raceId: "1",
  classId: "1",
};

const base = "/profile/wow/character/example-realm";

let server: ReturnType<typeof serve> | undefined;

async function startStub(quests: 404 | 503): Promise<string> {
  const app = new Hono();
  app.post("/token", (context) =>
    context.json({
      access_token: "stub-access-token",
      token_type: "bearer",
      expires_in: 3600,
    }),
  );
  app.get(base, (context) =>
    context.json({ id: 101, name: "Example", level: 20 }),
  );
  app.get(`${base}/quests`, (context) =>
    context.json({ error: "quests" }, quests),
  );
  app.get("*", (context) => context.json({ error: "missing" }, 404));

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

async function sourceFor(quests: 404 | 503) {
  const client = await createGuildBattleNetClient({
    key: "local",
    secret: "local",
    origin: "eu",
    apiBaseUrl: await startStub(quests),
  });
  return makeBattleNetCharacterProfileSource(client, {
    icon: (id) => `/icons/${String(id)}`,
    avatar: (slug) => `/avatars/${slug}`,
  });
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe("Battle.net character profile source", () => {
  it("reads a document the character does not have as empty", async () => {
    const source = await sourceFor(404);
    const result = await source.fetchProfile(character, "en");
    expect(result.ok).toBe(true);
  });

  it("fails the whole profile when a document does not answer", async () => {
    const source = await sourceFor(503);
    const result = await source.fetchProfile(character, "en");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  }, 15_000);
});
