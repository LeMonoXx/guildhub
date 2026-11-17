import {
  guildPartyResponseSchema,
  worldMapAtlasSchema,
  type GuildPartyResponse,
  type WorldMapAtlas,
} from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";

const member = (
  slug: string,
  classId: string,
  level: number,
  roles: string[],
  focus?: { area: string; areaId: number },
) => ({
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  surname: "Example",
  classId,
  level,
  roles,
  published: true,
  lastLoginAt: "2026-11-17T10:00:00.000Z",
  ...(focus === undefined ? {} : { focus }),
});

const barrens = { area: "The Barrens", areaId: 17 };

export const fixtureGuildParty = (): GuildPartyResponse =>
  parseContract(guildPartyResponseSchema, {
    coverage: { members: 4, profiles: 4 },
    members: [
      member("brightforge", "1", 24, ["tank", "damage"], barrens),
      member("shade", "4", 23, ["damage"], barrens),
      member("lumen", "5", 23, ["healer", "damage"], barrens),
      member("ember", "8", 22, ["damage"]),
    ],
    quests: [
      {
        id: 4921,
        name: "Lost in Battle",
        ...barrens,
        minLevel: 17,
        members: ["brightforge", "shade", "lumen"],
      },
      {
        id: 1221,
        name: "Blueleaf Tubers",
        area: "Razorfen Kraul",
        areaId: 491,
        minLevel: 20,
        members: ["brightforge", "ember"],
      },
    ],
    areas: [
      {
        ...barrens,
        members: [
          { slug: "brightforge", quests: 3 },
          { slug: "shade", quests: 2 },
          { slug: "lumen", quests: 1 },
        ],
      },
    ],
    dungeons: [
      {
        key: "shadowfangKeep",
        minLevel: 22,
        maxLevel: 30,
        entrance: { areaId: 130, x: 0.45, y: 0.68 },
        areaIds: [209],
        members: ["brightforge", "shade", "lumen", "ember"],
        group: [
          { slug: "brightforge", role: "tank" },
          { slug: "lumen", role: "healer" },
          { slug: "shade", role: "damage" },
          { slug: "ember", role: "damage" },
        ],
        missing: ["damage"],
        quests: [],
        boss: { displayId: 2353, level: 26 },
      },
    ],
    fetchedAt: "2026-11-17T12:00:00.000Z",
    stale: false,
  });

export const fixtureWorldMap = (): WorldMapAtlas =>
  parseContract(worldMapAtlasSchema, {
    version: 1,
    build: "1.60.1.70938",
    continents: [
      {
        uiMapId: 1414,
        name: "Kalimdor",
        image: { path: "maps/v1/1414.png", width: 1002, height: 668 },
        zones: [
          {
            uiMapId: 1413,
            name: "The Barrens",
            areaIds: [17, 380],
            rect: { left: 0.392, top: 0.456, right: 0.668, bottom: 0.731 },
            image: { path: "maps/v1/1413.png", width: 1002, height: 668 },
          },
        ],
      },
      {
        uiMapId: 1415,
        name: "Eastern Kingdoms",
        image: { path: "maps/v1/1415.png", width: 1002, height: 668 },
        zones: [
          {
            uiMapId: 1421,
            name: "Silverpine Forest",
            areaIds: [130],
            rect: { left: 0.357, top: 0.247, right: 0.476, bottom: 0.366 },
            image: { path: "maps/v1/1421.png", width: 1002, height: 668 },
          },
        ],
      },
    ],
  });
