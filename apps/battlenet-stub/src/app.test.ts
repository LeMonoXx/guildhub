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

  it("can fail with 503 for degraded-path tests", async () => {
    const response = await app.request(
      "/data/wow/guild/example-guild/roster?fail=503",
    );
    expect(response.status).toBe(503);
  });
});
