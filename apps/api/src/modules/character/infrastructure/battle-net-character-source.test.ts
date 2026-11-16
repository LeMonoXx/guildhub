import { describe, expect, it } from "vitest";
import { makeBattleNetCharacterSource } from "./battle-net-character-source.js";

const character = {
  characterId: "101",
  name: "Memento",
  surname: "Morí",
  slug: "memento-mori",
  raceId: "5",
  classId: "5",
};

describe("battle-net character source", () => {
  it("keeps gear when appearance or media is missing", async () => {
    const source = makeBattleNetCharacterSource({
      defaults: { token: "stub" },
      refreshAccessToken: () => Promise.resolve(),
      sendRequest: (resource: { path: string }) => {
        if (resource.path.includes("/appearance")) {
          return Promise.reject(httpError(404));
        }
        if (resource.path.includes("/character-media")) {
          return Promise.reject(httpError(404));
        }
        return Promise.resolve({
          equipped_items: [{ item: { id: 16820 }, slot: { type: "CHEST" } }],
        });
      },
    } as never);
    const result = await source.fetchFacts(character);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      raceId: 5,
      classId: 5,
      itemIds: [16820],
    });
    expect(result.value.renderAssetUrl).toBeUndefined();
  });

  it("rejects answers that describe a different character", async () => {
    const source = makeBattleNetCharacterSource({
      defaults: { token: "stub" },
      refreshAccessToken: () => Promise.resolve(),
      sendRequest: () =>
        Promise.resolve({
          character: { id: 999 },
          equipped_items: [{ item: { id: 1 }, slot: { type: "CHEST" } }],
        }),
    } as never);
    await expect(source.fetchFacts(character)).resolves.toEqual({
      ok: false,
      error: { code: "character.not_found" },
    });
  });

  it("fails instead of baking a bare figure when appearance does not answer", async () => {
    const source = makeBattleNetCharacterSource({
      defaults: { token: "stub" },
      refreshAccessToken: () => Promise.resolve(),
      sendRequest: (resource: { path: string }) =>
        resource.path.includes("/appearance")
          ? Promise.reject(httpError(503))
          : Promise.resolve({
              equipped_items: [
                { item: { id: 16820 }, slot: { type: "CHEST" } },
              ],
            }),
    } as never);
    await expect(source.fetchFacts(character)).resolves.toMatchObject({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  }, 15_000);

  it("returns character.not_found when every profile call is missing", async () => {
    const source = makeBattleNetCharacterSource({
      defaults: { token: "stub" },
      refreshAccessToken: () => Promise.resolve(),
      sendRequest: () => Promise.reject(httpError(404)),
    } as never);
    await expect(source.fetchFacts(character)).resolves.toEqual({
      ok: false,
      error: { code: "character.not_found" },
    });
  });
});

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${String(status)}`), {
    response: { status },
  });
}
