import { describe, expect, it } from "vitest";
import type { LookDescription } from "../domain/look.js";
import { lookHash } from "./look-hash.js";

const look: LookDescription = {
  clientBuild: "1.60.1.70938",
  raceId: 5,
  sex: 0,
  classId: 2,
  customizations: [{ optionId: 58, choiceId: 915 }],
  itemIds: [3732],
  equipmentOverrides: [],
};

describe("lookHash", () => {
  it("is a 16-character hex digest of the canonical look", () => {
    expect(lookHash(look)).toMatch(/^[0-9a-f]{16}$/);
    expect(lookHash(look)).toBe(lookHash({ ...look, itemIds: [3732] }));
    expect(lookHash({ ...look, sex: 1 })).not.toBe(lookHash(look));
  });
});
