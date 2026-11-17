import type { InstanceConfig } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../platform/http/app.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { createLogger } from "../../../platform/observability/logger.js";
import { makeGetFeaturedMembers } from "../application/get-featured-members.js";
import { rankId } from "../domain/roster-member.js";
import { registerGuild } from "./routes.js";

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

const rosterMember = {
  characterId: "101",
  name: "Guildmaster",
  surname: "Example",
  level: 80,
  rankId: rankId(0),
  classId: "1",
  raceId: "1",
  slug: "guildmaster-example",
};

function app(overrides?: {
  getGuild?: Parameters<typeof registerGuild>[1]["getGuild"];
  getGuildRoster?: Parameters<typeof registerGuild>[1]["getGuildRoster"];
  getFeaturedMembers?: Parameters<
    typeof registerGuild
  >[1]["getFeaturedMembers"];
  stale?: string[];
}) {
  const stale: string[] = overrides?.stale ?? [];
  const hono = createApp({
    logger,
    serviceName: "guildhub-api-test",
  });
  const getGuildRoster =
    overrides?.getGuildRoster ??
    (() =>
      Promise.resolve(
        ok({
          data: [rosterMember],
          fetchedAt,
          stale: false,
        }),
      ));
  registerGuild(hono, {
    instance,
    getGuild:
      overrides?.getGuild ??
      (() =>
        Promise.resolve(
          ok({
            data: {
              id: "1",
              slug: "example-guild",
              name: "Example Guild",
              faction: "ALLIANCE",
              achievementPoints: 0,
              memberCount: 2,
            },
            fetchedAt,
            stale: false,
          }),
        )),
    getGuildRoster,
    getFeaturedMembers:
      overrides?.getFeaturedMembers ??
      makeGetFeaturedMembers({ getRoster: getGuildRoster }),
    onStaleCache: (kind) => {
      stale.push(kind);
    },
  });
  return hono;
}

describe("GET /api/guild", () => {
  it("returns the instance guild profile", async () => {
    const response = await app().request("/api/guild");
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe(
      `"2026-11-13T12:00:00.000Z-fresh"`,
    );
    await expect(response.json()).resolves.toEqual({
      id: "1",
      slug: "example-guild",
      name: "Example Guild",
      faction: "ALLIANCE",
      achievementPoints: 0,
      memberCount: 2,
      fetchedAt: "2026-11-13T12:00:00.000Z",
      stale: false,
    });
  });

  it("maps guild.not_found to RFC 9457", async () => {
    const response = await app({
      getGuild: () => Promise.resolve(err(appError("guild.not_found"))),
    }).request("/api/guild");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(
      /application\/problem\+json/,
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "guild.not_found",
      status: 404,
    });
  });

  it("maps upstream.unavailable to 503", async () => {
    const response = await app({
      getGuild: () => Promise.resolve(err(appError("upstream.unavailable"))),
    }).request("/api/guild");
    expect(response.status).toBe(503);
  });

  it("notes stale cache on the response", async () => {
    const stale: string[] = [];
    const response = await app({
      stale,
      getGuild: () =>
        Promise.resolve(
          ok({
            data: {
              id: "1",
              slug: "example-guild",
              name: "Example Guild",
              faction: "ALLIANCE",
              achievementPoints: 0,
              memberCount: 2,
            },
            fetchedAt,
            stale: true,
          }),
        ),
    }).request("/api/guild");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ stale: true });
    expect(stale).toEqual(["profile"]);
  });
});

describe("GET /api/guild/roster", () => {
  it("returns the roster", async () => {
    const response = await app().request("/api/guild/roster");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      members: [
        {
          characterId: "101",
          name: "Guildmaster",
          surname: "Example",
          level: 80,
          rankId: 0,
          classId: "1",
          raceId: "1",
          slug: "guildmaster-example",
        },
      ],
      fetchedAt: "2026-11-13T12:00:00.000Z",
      stale: false,
    });
  });
});

describe("GET /api/guild/featured", () => {
  it("returns presented featured members", async () => {
    const response = await app().request("/api/guild/featured");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      members: [
        {
          slug: "guildmaster-example",
          pose: "Stand",
          lookManifest: "/assets/looks/fixed/look.json",
        },
      ],
      stale: false,
    });
  });
});
