import type { EquippedItem } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { rankId } from "../../guild/index.js";
import { emptyProfileData } from "../domain/profile.js";
import { makeGetItem } from "./get-item.js";
import type { ItemCatalog } from "./ports.js";

const guild = { slug: "example" };

const leggings: EquippedItem = {
  slot: "LEGS",
  slotName: "Beine",
  itemId: 15450,
  name: "Gamaschen des Sumpfgräbers",
  quality: "UNCOMMON",
  qualityName: "Selten",
  itemLevel: 18,
  armor: "48 Rüstung",
  stats: [],
  enchantments: ["+5 Ausdauer"],
  durability: { current: 20, max: 55 },
  quantity: 1,
};

function setup(items: ItemCatalog) {
  return makeGetItem({
    items,
    getRoster: () =>
      Promise.resolve(
        ok({
          data: [
            {
              characterId: "7",
              name: "Eisfell",
              surname: "Stinkstiefen",
              level: 17,
              rankId: rankId(4),
              classId: "3",
              raceId: "2",
              slug: "eisfell-stinkstiefen",
            },
          ],
          fetchedAt: new Date(),
          stale: false,
        }),
      ),
    profiles: {
      latestMany: () =>
        Promise.resolve([
          {
            characterId: "7",
            slug: "eisfell-stinkstiefen",
            status: "available" as const,
            data: { ...emptyProfileData(17), equipment: [leggings] },
            fetchedAt: new Date(),
          },
        ]),
      save: () => Promise.resolve(),
    },
  });
}

describe("getItem", () => {
  it("serves Battle.net's item data when it knows the item", async () => {
    const getItem = setup({
      item: (itemId) => Promise.resolve(ok({ ...leggings, itemId, name: "X" })),
    });
    const result = await getItem({ guild, itemId: 15450, locale: "de" });
    expect(result.ok && result.value.name).toBe("X");
  });

  it("falls back to the item as a member wears it, without their copy's wear", async () => {
    const getItem = setup({
      item: () => Promise.resolve(err(appError("item.not_found"))),
    });
    const result = await getItem({ guild, itemId: 15450, locale: "de" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ armor: "48 Rüstung" });
    expect(result.value.enchantments).toEqual([]);
    expect(result.value.durability).toBeUndefined();
  });

  it("stays not found when nobody wears it either", async () => {
    const getItem = setup({
      item: () => Promise.resolve(err(appError("item.not_found"))),
    });
    const result = await getItem({ guild, itemId: 1, locale: "de" });
    expect(result.ok).toBe(false);
  });

  it("does not hide an unreachable Battle.net behind a member's copy", async () => {
    const getItem = setup({
      item: () => Promise.resolve(err(appError("upstream.unavailable"))),
    });
    const result = await getItem({ guild, itemId: 15450, locale: "de" });
    expect(!result.ok && result.error.code).toBe("upstream.unavailable");
  });
});
