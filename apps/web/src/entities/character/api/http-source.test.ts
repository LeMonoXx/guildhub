import { afterEach, describe, expect, test, vi } from "vitest";
import { createHttpCharacterSource } from "./http-source";
import { CharacterNotFoundError } from "./source";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("http character source", () => {
  test("maps character.not_found to CharacterNotFoundError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "/problems/character.not_found",
          title: "This character was not found.",
          status: 404,
          code: "character.not_found",
        }),
        { status: 404 },
      ),
    );
    await expect(
      createHttpCharacterSource().getBySlug("missing"),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });
});
