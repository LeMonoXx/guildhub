import type { DungeonKey, GuildFaction } from "@guildhub/contracts";

export interface Dungeon {
  readonly key: DungeonKey;
  readonly minLevel: number;
  readonly maxLevel: number;
  /** Only this faction can reach the entrance safely. */
  readonly faction?: Exclude<GuildFaction, "NEUTRAL">;
  /** The entrance on its zone's map; `areaId` is the zone's area. */
  readonly entrance: {
    readonly areaId: number;
    readonly x: number;
    readonly y: number;
  };
  /** The instance's own areas, which quests that lead inside name. */
  readonly areaIds: readonly number[];
  /** The last boss: its creature display in the game files and its level, absent for a skull. */
  readonly boss: { readonly displayId: number; readonly level?: number };
}

/** Classic's five-player dungeons with their usual level brackets. */
export const DUNGEONS: readonly Dungeon[] = [
  {
    key: "ragefireChasm",
    minLevel: 13,
    maxLevel: 18,
    faction: "HORDE",
    entrance: { areaId: 1637, x: 0.52, y: 0.49 },
    areaIds: [2437],
    boss: { displayId: 7970, level: 16 },
  },
  {
    key: "wailingCaverns",
    minLevel: 17,
    maxLevel: 24,
    entrance: { areaId: 17, x: 0.46, y: 0.36 },
    areaIds: [718],
    boss: { displayId: 4088, level: 22 },
  },
  {
    key: "deadmines",
    minLevel: 17,
    maxLevel: 26,
    faction: "ALLIANCE",
    entrance: { areaId: 40, x: 0.42, y: 0.72 },
    areaIds: [1581],
    boss: { displayId: 2029, level: 21 },
  },
  {
    key: "shadowfangKeep",
    minLevel: 22,
    maxLevel: 30,
    entrance: { areaId: 130, x: 0.45, y: 0.68 },
    areaIds: [209],
    boss: { displayId: 2353, level: 26 },
  },
  {
    key: "blackfathomDeeps",
    minLevel: 24,
    maxLevel: 32,
    entrance: { areaId: 331, x: 0.14, y: 0.14 },
    areaIds: [719],
    boss: { displayId: 2837, level: 28 },
  },
  {
    key: "stockade",
    minLevel: 24,
    maxLevel: 32,
    faction: "ALLIANCE",
    entrance: { areaId: 1519, x: 0.41, y: 0.56 },
    areaIds: [717],
    boss: { displayId: 1621, level: 29 },
  },
  {
    key: "gnomeregan",
    minLevel: 29,
    maxLevel: 38,
    entrance: { areaId: 1, x: 0.24, y: 0.4 },
    areaIds: [721],
    boss: { displayId: 6980, level: 34 },
  },
  {
    key: "razorfenKraul",
    minLevel: 29,
    maxLevel: 38,
    entrance: { areaId: 17, x: 0.41, y: 0.9 },
    areaIds: [491],
    boss: { displayId: 4642, level: 37 },
  },
  {
    key: "scarletMonastery",
    minLevel: 28,
    maxLevel: 45,
    entrance: { areaId: 85, x: 0.83, y: 0.33 },
    areaIds: [796],
    boss: { displayId: 2043, level: 42 },
  },
  {
    key: "razorfenDowns",
    minLevel: 37,
    maxLevel: 46,
    entrance: { areaId: 17, x: 0.49, y: 0.94 },
    areaIds: [722],
    boss: { displayId: 7971, level: 41 },
  },
  {
    key: "uldaman",
    minLevel: 41,
    maxLevel: 51,
    entrance: { areaId: 3, x: 0.44, y: 0.12 },
    areaIds: [1337],
    boss: { displayId: 5988, level: 47 },
  },
  {
    key: "zulFarrak",
    minLevel: 44,
    maxLevel: 54,
    entrance: { areaId: 440, x: 0.39, y: 0.2 },
    areaIds: [1176],
    boss: { displayId: 6439, level: 48 },
  },
  {
    key: "maraudon",
    minLevel: 46,
    maxLevel: 55,
    entrance: { areaId: 405, x: 0.29, y: 0.62 },
    areaIds: [2100],
    boss: { displayId: 12292, level: 51 },
  },
  {
    key: "sunkenTemple",
    minLevel: 50,
    maxLevel: 60,
    entrance: { areaId: 8, x: 0.7, y: 0.54 },
    areaIds: [1417, 1477],
    boss: { displayId: 7806, level: 55 },
  },
  {
    key: "blackrockDepths",
    minLevel: 52,
    maxLevel: 60,
    entrance: { areaId: 51, x: 0.35, y: 0.85 },
    areaIds: [1584],
    boss: { displayId: 8807, level: 59 },
  },
  {
    key: "blackrockSpire",
    minLevel: 55,
    maxLevel: 60,
    entrance: { areaId: 51, x: 0.37, y: 0.83 },
    areaIds: [1583],
    boss: { displayId: 10115 },
  },
  {
    key: "direMaul",
    minLevel: 55,
    maxLevel: 60,
    entrance: { areaId: 357, x: 0.59, y: 0.45 },
    areaIds: [2557],
    boss: { displayId: 11583, level: 62 },
  },
  {
    key: "scholomance",
    minLevel: 58,
    maxLevel: 60,
    entrance: { areaId: 28, x: 0.7, y: 0.73 },
    areaIds: [2057],
    boss: { displayId: 11070, level: 61 },
  },
  {
    key: "stratholme",
    minLevel: 58,
    maxLevel: 60,
    entrance: { areaId: 139, x: 0.31, y: 0.15 },
    areaIds: [2017],
    boss: { displayId: 10729, level: 62 },
  },
];

/** Members this many levels below a bracket still make it through with a group. */
export const LEVEL_REACH = 2;

/** Every last boss the worker bakes a model for. */
export const BOSS_DISPLAY_IDS: readonly number[] = DUNGEONS.map(
  (dungeon) => dungeon.boss.displayId,
);

export const reachableBy = (
  dungeon: Dungeon,
  faction: GuildFaction | undefined,
): boolean =>
  dungeon.faction === undefined ||
  faction === undefined ||
  faction === "NEUTRAL" ||
  dungeon.faction === faction;

export const fitsLevel = (dungeon: Dungeon, level: number): boolean =>
  level >= dungeon.minLevel - LEVEL_REACH && level <= dungeon.maxLevel;
