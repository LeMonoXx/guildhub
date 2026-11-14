import { describe, expect, it } from "vitest";
import { createStubApp } from "./app.js";

const app = createStubApp();

describe("Battle.net stub", () => {
  it("issues a client-credentials token", async () => {
    const response = await app.request("/token?grant_type=client_credentials", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "stub-access-token",
      token_type: "bearer",
    });
  });

  it("returns a guild roster fixture", async () => {
    const response = await app.request("/data/wow/guild/example-guild/roster");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      members: { rank: number }[];
    };
    expect(body.members).toHaveLength(2);
    expect(body.members[0]?.rank).toBe(0);
  });

  it("returns Forever appearance, equipment, and media for a character slug", async () => {
    const appearance = await app.request(
      "/profile/wow/character/guildmaster-example/appearance",
    );
    const equipment = await app.request(
      "/profile/wow/character/guildmaster-example/equipment",
    );
    const media = await app.request(
      "/profile/wow/character/guildmaster-example/character-media",
    );
    expect(appearance.status).toBe(200);
    expect(equipment.status).toBe(200);
    expect(media.status).toBe(200);
    const appearanceBody = (await appearance.json()) as {
      gender: { type: string };
      customizations: { option: { id: number } }[];
    };
    const mediaBody = (await media.json()) as {
      assets: { key: string }[];
    };
    expect(appearanceBody.gender.type).toBe("MALE");
    expect(appearanceBody.customizations[0]?.option.id).toBe(58);
    expect(mediaBody.assets[0]?.key).toBe("main-raw");
  });

  it("returns a distinct look for the second roster member", async () => {
    const appearance = await app.request(
      "/profile/wow/character/member-example/appearance",
    );
    expect(appearance.status).toBe(200);
    await expect(appearance.json()).resolves.toMatchObject({
      playable_race: { id: 4 },
      playable_class: { id: 8 },
      gender: { type: "FEMALE" },
    });
  });

  it("can fail with 503 for degraded-path tests", async () => {
    const response = await app.request(
      "/data/wow/guild/example-guild/roster?fail=503",
    );
    expect(response.status).toBe(503);
  });
});
