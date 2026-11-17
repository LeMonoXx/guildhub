import type { InstanceConfig } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../platform/http/app.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { createLogger } from "../../../platform/observability/logger.js";
import { rankId } from "../../guild/domain/roster-member.js";
import type { CharacterView } from "../application/character-view.js";
import { emptyProfileData } from "../domain/profile.js";
import { registerCharacter } from "./routes.js";

const instance: InstanceConfig = {
  slug: "example-guild",
  name: "Example Guild",
  region: "eu",
  guild: { slug: "example-guild", featured: [] },
};

const fetchedAt = new Date("2026-11-13T12:00:00.000Z");
const logger = createLogger({
  level: "silent",
  serviceName: "guildhub-api-test",
});

const view: CharacterView = {
  member: {
    characterId: "101",
    name: "Guildmaster",
    surname: "Example",
    level: 80,
    rankId: rankId(0),
    classId: "1",
    raceId: "1",
    slug: "guildmaster-example",
  },
  published: true,
  model: {
    status: "pending",
    lookHash: "abc123",
    clientBuild: "1.60.1.70938",
    renderUrl: "/api/characters/guildmaster-example/render",
  },
  lookManifest: "/assets/looks/fixed/look.json",
  renderUrl: "/api/characters/guildmaster-example/render",
  pose: "Stand",
  accent: "class-1",
  carries: [],
};

type Deps = Parameters<typeof registerCharacter>[1];

const profileSnapshot = {
  characterId: "101",
  slug: "guildmaster-example",
  status: "available" as const,
  data: emptyProfileData(80),
  fetchedAt,
};

function app(overrides?: {
  getCharacter?: Deps["getCharacter"];
  getCharacterRender?: Deps["getCharacterRender"];
  getCharacterProfile?: Deps["getCharacterProfile"];
  getItemIcon?: Deps["getItemIcon"];
}) {
  const png = () =>
    Promise.resolve(
      ok({ body: new Uint8Array([1, 2, 3]), contentType: "image/png" }),
    );
  const hono = createApp({
    logger,
    serviceName: "guildhub-api-test",
  });
  registerCharacter(hono, {
    instance,
    getCharacter:
      overrides?.getCharacter ??
      (() => Promise.resolve(ok({ data: view, fetchedAt, stale: false }))),
    getCharacterRender: overrides?.getCharacterRender ?? png,
    getCharacterAvatar: png,
    getCharacterProfile:
      overrides?.getCharacterProfile ??
      (() =>
        Promise.resolve(
          ok({
            data: { member: view.member, profile: profileSnapshot },
            fetchedAt,
            stale: false,
          }),
        )),
    getItemIcon: overrides?.getItemIcon ?? png,
    onStaleCache: () => undefined,
  });
  return hono;
}

describe("GET /api/characters/:slug", () => {
  it("returns the presented character with model status", async () => {
    const response = await app().request("/api/characters/guildmaster-example");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      slug: "guildmaster-example",
      name: "Guildmaster",
      lookManifest: "/assets/looks/fixed/look.json",
      model: { status: "pending", lookHash: "abc123" },
      stale: false,
    });
  });

  it("maps character.not_found to RFC 9457", async () => {
    const response = await app({
      getCharacter: () => Promise.resolve(err(appError("character.not_found"))),
    }).request("/api/characters/missing");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "character.not_found",
    });
  });

  it("rejects an invalid slug as not found", async () => {
    const response = await app().request("/api/characters/Not-A-Slug");
    expect(response.status).toBe(404);
  });
});

describe("GET /api/characters/:slug/render", () => {
  it("returns the proxied official render", async () => {
    const response = await app().request(
      "/api/characters/guildmaster-example/render",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });
});

describe("GET /api/characters/:slug/profile", () => {
  it("returns the normalized profile", async () => {
    const response = await app().request(
      "/api/characters/guildmaster-example/profile",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      characterId: "101",
      status: "available",
      summary: { level: 80 },
      equipment: [],
      stale: false,
    });
  });

  it("maps character.not_found to RFC 9457", async () => {
    const response = await app({
      getCharacterProfile: () =>
        Promise.resolve(err(appError("character.not_found"))),
    }).request("/api/characters/missing/profile");
    expect(response.status).toBe(404);
  });
});

describe("GET /api/icons/:iconId", () => {
  it("serves an icon with an immutable cache", async () => {
    const response = await app().request("/api/icons/133060");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("does not match non-numeric ids", async () => {
    const response = await app().request("/api/icons/abc");
    expect(response.status).toBe(404);
  });
});
