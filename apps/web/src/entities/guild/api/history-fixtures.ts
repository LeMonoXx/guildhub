import {
  guildHistoryResponseSchema,
  type GuildHistoryResponse,
} from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";

const shade = {
  slug: "shade",
  name: "Shade",
  surname: "Example",
  classId: "4",
};
const brightforge = {
  slug: "brightforge",
  name: "Brightforge",
  surname: "Example",
  classId: "2",
};

const days = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];

export const fixtureGuildHistory = (): GuildHistoryResponse =>
  parseContract(guildHistoryResponseSchema, {
    since: days[0],
    series: days.map((day, index) => ({
      day,
      members: 13 + Math.min(index, 1),
      averageLevel: 76 + index,
      averageItemLevel: 52 + index * 2,
      achievements: 120 + index * 3,
    })),
    events: [
      { ...shade, day: days[3], kind: "level", from: 79, to: 80 },
      {
        ...shade,
        day: days[3],
        kind: "item",
        slot: "HEAD",
        itemId: 16_866,
        item: "Helm of Wrath",
        quality: "EPIC",
        itemLevel: 76,
      },
      {
        ...brightforge,
        day: days[2],
        kind: "profession",
        profession: "Blacksmithing",
        from: 280,
        to: 300,
      },
      {
        ...brightforge,
        day: days[2],
        kind: "reputation",
        faction: "Argent Dawn",
        standing: "Honored",
        tier: 5,
      },
      { ...shade, day: days[1], kind: "achievements", count: 2, points: 20 },
      { ...brightforge, day: days[1], kind: "mount", mount: "Black Stallion" },
      { ...brightforge, day: days[1], kind: "joined" },
    ],
  });
