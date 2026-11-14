import { describe, expect, it } from "vitest";
import { canonicalLookKey, type LookDescription } from "./look.js";

const look = (overrides?: Partial<LookDescription>): LookDescription => ({
  clientBuild: "1.60.1.70938",
  raceId: 1,
  sex: 0,
  classId: 4,
  customizations: [
    { optionId: 58, choiceId: 915 },
    { optionId: 20, choiceId: 385 },
  ],
  itemIds: [19019, 16820],
  equipmentOverrides: [{ itemId: 19019, equipSlot: 16 }],
  ...overrides,
});

describe("canonicalLookKey", () => {
  it("is stable regardless of customization and item order", () => {
    const shuffled = look({
      customizations: [
        { optionId: 20, choiceId: 385 },
        { optionId: 58, choiceId: 915 },
      ],
      itemIds: [16820, 19019],
    });
    expect(canonicalLookKey(shuffled)).toBe(canonicalLookKey(look()));
  });

  it("changes when race, sex, a choice, or an item changes", () => {
    const base = canonicalLookKey(look());
    expect(canonicalLookKey(look({ raceId: 5 }))).not.toBe(base);
    expect(canonicalLookKey(look({ sex: 1 }))).not.toBe(base);
    expect(
      canonicalLookKey(
        look({ customizations: [{ optionId: 58, choiceId: 1 }] }),
      ),
    ).not.toBe(base);
    expect(canonicalLookKey(look({ itemIds: [16820] }))).not.toBe(base);
    expect(canonicalLookKey(look({ clientBuild: "1.61.0.1" }))).not.toBe(base);
  });
});
