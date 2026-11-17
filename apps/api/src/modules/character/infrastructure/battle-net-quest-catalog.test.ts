import { describe, expect, it } from "vitest";
import { mapQuestDocument } from "./battle-net-quest-catalog.js";

describe("mapQuestDocument", () => {
  it("keeps the text, the place, and the reward", () => {
    expect(
      mapQuestDocument({
        description: "Bring the report back.",
        area: { id: 14, name: "Durotar" },
        category: { id: 1, name: "Horde" },
        is_daily: true,
        requirements: { min_character_level: 5 },
        rewards: {
          experience: 250,
          money: { value: 150 },
          items: {
            items: [{ item: { id: 9, name: "Worn Axe" } }],
            choice_of: [{ item: { id: 10, name: "Worn Dagger" } }],
          },
        },
      }),
    ).toEqual({
      description: "Bring the report back.",
      area: "Durotar",
      areaId: 14,
      category: "Horde",
      cadence: "daily",
      minLevel: 5,
      experience: 250,
      moneyCopper: 150,
      itemRewards: ["Worn Axe", "Worn Dagger"],
    });
  });

  it("drops an empty document", () => {
    expect(mapQuestDocument({})).toEqual({});
  });
});
