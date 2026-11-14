import { guildProfileResponseSchema } from "@guildhub/contracts";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, getJson } from "./http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getJson", () => {
  test("parses a successful contract payload", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "1",
          slug: "example-guild",
          name: "Example Guild",
          faction: "ALLIANCE",
          achievementPoints: 0,
          memberCount: 2,
          fetchedAt: "2026-11-13T12:00:00.000Z",
          stale: false,
        }),
        { status: 200 },
      ),
    );
    await expect(
      getJson("/api/guild", guildProfileResponseSchema),
    ).resolves.toMatchObject({ slug: "example-guild", stale: false });
  });

  test("maps RFC 9457 bodies to ApiError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "/problems/guild.not_found",
          title: "This guild was not found.",
          status: 404,
          code: "guild.not_found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );
    await expect(
      getJson("/api/guild", guildProfileResponseSchema),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "guild.not_found",
      status: 404,
    });
  });

  test("maps a network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("failed"));
    await expect(
      getJson("/api/guild", guildProfileResponseSchema),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
