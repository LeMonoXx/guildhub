import { describe, expect, it } from "vitest";
import { detailsOf } from "./battle-net-achievement-catalog.js";

describe("detailsOf", () => {
  it("keeps description, category, reward and the child criteria", () => {
    expect(
      detailsOf({
        name: "Journeyman Alchemist",
        description: "Reach 150 skill in Alchemy for the first time.",
        category: { name: "Alchemy" },
        reward_description: "Earn 1 Legacy Point.",
        criteria: {
          description: "150 Skill in Alchemy",
          child_criteria: [{ description: "150 Alchemy Skill" }],
        },
      }),
    ).toEqual({
      description: "Reach 150 skill in Alchemy for the first time.",
      category: "Alchemy",
      reward: "Earn 1 Legacy Point.",
      criteria: ["150 Alchemy Skill"],
    });
  });

  it("uses a lone criterion only when it adds to the description", () => {
    expect(
      detailsOf({
        description: "Level 25 Mage",
        criteria: { description: "Level 25 Mage" },
      }),
    ).toEqual({ description: "Level 25 Mage" });
    expect(
      detailsOf({
        description: "Reach level 25 for the first time on a Mage.",
        criteria: { description: "Level 25 Mage" },
      }),
    ).toMatchObject({ criteria: ["Level 25 Mage"] });
  });

  it("returns nothing for a body without texts", () => {
    expect(detailsOf({ id: 1 })).toBeUndefined();
  });
});
