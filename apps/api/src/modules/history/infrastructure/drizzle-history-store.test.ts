import { describe, expect, it } from "vitest";
import { membersSchema } from "./drizzle-history-store.js";

describe("membersSchema", () => {
  it("keeps every field a member is stored with", () => {
    const member = {
      characterId: "1",
      slug: "aria",
      name: "Aria",
      surname: "",
      classId: "mage",
      level: 20,
      rankId: 3,
      published: true,
      achievementPoints: 100,
      achievements: 10,
      recentAchievements: [
        { id: 7, name: "Level 20", at: "2026-11-02T01:30:00.000Z" },
      ],
      equipment: [],
      professions: [],
      reputations: [],
      mounts: [],
    };
    expect(membersSchema.parse([member])).toEqual([member]);
  });
});
