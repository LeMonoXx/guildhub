import type {
  CharacterHistoryPoint,
  GuildHistoryPoint,
} from "@guildhub/contracts";
import type { GuildCheck } from "./guild-check.js";

export function guildSeries(
  checks: readonly GuildCheck[],
): GuildHistoryPoint[] {
  return checks.map((check) => {
    const itemLevels = check.members.flatMap((m) =>
      m.itemLevel === undefined ? [] : [m.itemLevel],
    );
    return {
      day: check.day,
      at: check.recordedAt.toISOString(),
      members: check.members.length,
      averageLevel: round(average(check.members.map((m) => m.level)) ?? 0),
      ...(itemLevels.length === 0
        ? {}
        : { averageItemLevel: round(average(itemLevels) ?? 0) }),
      achievements: check.members.reduce(
        (total, member) => total + member.achievements,
        0,
      ),
    };
  });
}

export function memberSeries(
  checks: readonly GuildCheck[],
  characterId: string,
): CharacterHistoryPoint[] {
  return checks.flatMap((check) => {
    const member = check.members.find((m) => m.characterId === characterId);
    if (member === undefined) return [];
    return [
      {
        day: check.day,
        at: check.recordedAt.toISOString(),
        level: member.level,
        ...(member.itemLevel === undefined
          ? {}
          : { itemLevel: member.itemLevel }),
        achievements: member.achievements,
        ...(member.questsCompleted === undefined
          ? {}
          : { quests: member.questsCompleted }),
      },
    ];
  });
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
