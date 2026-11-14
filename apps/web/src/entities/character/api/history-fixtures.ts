import {
  characterHistoryResponseSchema,
  type CharacterHistoryResponse,
} from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";

const days = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];

export const fixtureCharacterHistory = (
  slug: string,
): CharacterHistoryResponse => {
  const ref = { slug, name: "Shade", surname: "Example", classId: "4" };
  return parseContract(characterHistoryResponseSchema, {
    since: days[0],
    series: days.map((day, index) => ({
      day,
      level: 77 + index,
      itemLevel: 50 + index * 3,
      achievements: 30 + index,
    })),
    events: [
      { ...ref, day: days[3], kind: "level", from: 79, to: 80 },
      {
        ...ref,
        day: days[3],
        kind: "item",
        slot: "HEAD",
        itemId: 16_866,
        item: "Helm of Wrath",
        quality: "EPIC",
        itemLevel: 76,
      },
      { ...ref, day: days[1], kind: "achievements", count: 2, points: 20 },
    ],
  });
};
