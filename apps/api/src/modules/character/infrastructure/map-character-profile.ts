import {
  int,
  isoFromMillis,
  list,
  name,
  num,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";
import type { AchievementInfo } from "./battle-net-achievement-catalog.js";
import { mapAchievements } from "./map-character-achievements.js";
import { mapCollections, mapHunterPets } from "./map-character-collections.js";
import { mapProfessions, mapSpecializations } from "./map-character-skills.js";
import {
  mapStatisticGroups,
  mapStatistics,
} from "./map-character-statistics.js";
import { mapEquippedItem } from "./map-equipped-item.js";
import { mapQuestLog, type QuestInfo } from "./map-quest-log.js";

export interface RawCharacterProfile {
  readonly summary?: unknown;
  readonly equipment?: unknown;
  readonly statistics?: unknown;
  readonly specializations?: unknown;
  readonly professions?: unknown;
  readonly reputations?: unknown;
  readonly titles?: unknown;
  readonly pvp?: unknown;
  readonly achievements?: unknown;
  readonly achievementStatistics?: unknown;
  readonly mounts?: unknown;
  readonly pets?: unknown;
  readonly toys?: unknown;
  readonly heirlooms?: unknown;
  readonly hunterPets?: unknown;
  readonly quests?: unknown;
  readonly completedQuests?: unknown;
}

export function mapCharacterProfile(input: {
  raw: RawCharacterProfile;
  fallbackLevel: number;
  iconUrl: (iconId: number) => string;
  itemIcons: ReadonlyMap<number, number>;
  achievementInfo?: ReadonlyMap<number, AchievementInfo>;
  questInfo?: ReadonlyMap<number, QuestInfo>;
  avatarUrl?: string;
}): CharacterProfileData {
  const { raw } = input;
  return {
    summary: mapSummary(raw.summary, input.fallbackLevel),
    ...optional("statistics", mapStatistics(raw.statistics)),
    equipment: list(rec(raw.equipment).equipped_items).flatMap((item) => {
      const mapped = mapEquippedItem(item, input.iconUrl, input.itemIcons);
      return mapped === undefined ? [] : [mapped];
    }),
    specializations: mapSpecializations(raw.specializations),
    professions: mapProfessions(raw.professions),
    reputations: mapReputations(raw.reputations),
    titles: list(rec(raw.titles).titles).flatMap((title) => {
      const value = titleOf(title);
      return value === undefined ? [] : [value];
    }),
    ...optional("pvp", mapPvp(raw.pvp)),
    achievements: mapAchievements(
      raw.achievements,
      input.iconUrl,
      input.achievementInfo,
    ),
    statisticGroups: mapStatisticGroups(raw.achievementStatistics),
    collections: mapCollections(raw),
    hunterPets: mapHunterPets(raw.hunterPets),
    quests: mapQuestLog(raw.quests, raw.completedQuests, input.questInfo),
    ...optional("avatarUrl", input.avatarUrl),
  };
}

function mapSummary(
  value: unknown,
  fallbackLevel: number,
): CharacterProfileData["summary"] {
  const summary = rec(value);
  return {
    level: int(summary.level) ?? fallbackLevel,
    ...optional("experience", int(summary.experience)),
    ...optional("gender", name(summary.gender)),
    ...optional("faction", name(summary.faction)),
    ...optional("race", name(summary.race)),
    ...optional("className", name(summary.character_class)),
    ...optional("guild", name(summary.guild)),
    ...optional("lastLoginAt", isoFromMillis(summary.last_login_timestamp)),
    ...optional("averageItemLevel", num(summary.average_item_level)),
    ...optional("equippedItemLevel", num(summary.equipped_item_level)),
    achievementPoints: int(summary.achievement_points) ?? 0,
    ...optional("activeTitle", titleOf(summary.active_title)),
    ...optional("ruleset", name(summary.ruleset)),
  };
}

function mapReputations(value: unknown): CharacterProfileData["reputations"] {
  return list(rec(value).reputations).flatMap((entry) => {
    const record = rec(entry);
    const faction = rec(record.faction);
    const standing = rec(record.standing);
    const factionId = int(faction.id);
    const factionName = str(faction.name);
    const standingName = str(standing.name);
    if (factionId === undefined || !factionName || !standingName) return [];
    return [
      {
        factionId,
        faction: factionName,
        standing: standingName,
        tier: int(standing.tier) ?? 0,
        value: int(standing.value) ?? 0,
        max: Math.max(0, int(standing.max) ?? 0),
      },
    ];
  });
}

function mapPvp(value: unknown): CharacterProfileData["pvp"] {
  if (value === undefined) return undefined;
  const pvp = rec(value);
  return {
    honorableKills: Math.max(0, int(pvp.honorable_kills) ?? 0),
    rank: Math.max(0, int(pvp.pvp_rank) ?? 0),
  };
}

function titleOf(value: unknown): string | undefined {
  const record = rec(value);
  return str(record.display_string) ?? str(record.name);
}
