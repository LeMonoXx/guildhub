import type { Recipe } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { RecipeIndex, type CrafterProfile } from "./recipe-index.js";

const recipe = (
  overrides: Partial<Recipe> & Pick<Recipe, "id" | "name">,
): Recipe => ({
  professionId: 171,
  profession: "Alchemy",
  category: "Elixirs",
  craftedQuantity: 1,
  reagents: [],
  source: { kind: "trainer" },
  ...overrides,
});

const giantGrowth = recipe({
  id: 4570,
  name: "Elixir of Giant Growth",
  craftedItem: {
    id: 6662,
    name: "Elixir of Giant Growth",
    quality: "COMMON",
    stats: [],
    effects: ["Use: Your size is increased and your Strength goes up by 8."],
  },
  reagents: [{ itemId: 6522, name: "Deviate Fish", quantity: 1 }],
  source: {
    kind: "recipe-item",
    item: {
      id: 6663,
      name: "Recipe: Elixir of Giant Growth",
      quality: "UNCOMMON",
    },
    requiredSkill: 90,
  },
});
const boots = recipe({
  id: 3860,
  name: "Bright Boots",
  professionId: 197,
  profession: "Tailoring",
  category: "Boots",
  craftedItem: {
    id: 4343,
    name: "Bright Boots",
    quality: "UNCOMMON",
    stats: [
      { type: "STAMINA", name: "Stamina", value: 3 },
      { type: "INTELLECT", name: "Intellect", value: 5 },
    ],
    effects: [],
  },
});
const cloak = recipe({
  id: 3861,
  name: "Brown Linen Cloak",
  professionId: 197,
  profession: "Tailoring",
  category: "Cloaks",
  craftedItem: {
    id: 2570,
    name: "Brown Linen Cloak",
    quality: "COMMON",
    stats: [{ type: "INTELLECT", name: "Intellect", value: 1 }],
    effects: [],
  },
});

const monox: CrafterProfile = {
  crafter: {
    characterId: "1",
    slug: "monox-belvar",
    name: "Monox",
    classId: "9",
  },
  professions: [
    {
      id: 171,
      skill: 165,
      recipeIds: [4570],
      recipes: ["Elixir of Giant Growth"],
    },
  ],
};
const silence: CrafterProfile = {
  crafter: {
    characterId: "2",
    slug: "silence-belvar",
    name: "Silence",
    classId: "5",
  },
  professions: [{ id: 197, skill: 120, recipes: ["Brown Linen Cloak"] }],
};

describe("RecipeIndex", () => {
  const index = new RecipeIndex([cloak, boots, giantGrowth]);
  const crafters = index.craftersOf([monox, silence]);

  it("finds recipes by every word, in names, effects and reagents, ignoring accents and case", () => {
    expect(
      index
        .search({ text: "STRENGTH size", offset: 0 }, crafters)
        .recipes.map((r) => r.id),
    ).toEqual([4570]);
    expect(index.search({ text: "deviate", offset: 0 }, crafters).total).toBe(
      1,
    );
    expect(index.search({ text: "élixir", offset: 0 }, crafters).total).toBe(1);
    expect(
      index.search({ text: "boots cloak", offset: 0 }, crafters).total,
    ).toBe(0);
  });

  it("filters by stat and ranks by its value, known recipes first", () => {
    const result = index.search({ stat: "INTELLECT", offset: 0 }, crafters);
    expect(result.recipes.map((r) => r.name)).toEqual([
      "Brown Linen Cloak",
      "Bright Boots",
    ]);
    expect(
      index.search({ stat: "INTELLECT", knownOnly: true, offset: 0 }, crafters)
        .total,
    ).toBe(1);
  });

  it("knows crafters by recipe id, or by name for older profiles", () => {
    expect(crafters.get(4570)?.map((c) => [c.name, c.skill])).toEqual([
      ["Monox", 165],
    ]);
    expect(crafters.get(3861)?.map((c) => c.name)).toEqual(["Silence"]);
    expect(crafters.get(3860)).toBeUndefined();
  });

  it("offers professions and stats to filter by", () => {
    expect(index.professions()).toEqual([
      { id: 171, name: "Alchemy", recipes: 1 },
      { id: 197, name: "Tailoring", recipes: 2 },
    ]);
    expect(index.stats().map((stat) => stat.type)).toEqual([
      "INTELLECT",
      "STAMINA",
    ]);
  });
});
