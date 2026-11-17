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

const sameValues = (a: CharacterHistoryPoint, b: CharacterHistoryPoint) =>
  a.level === b.level &&
  a.itemLevel === b.itemLevel &&
  a.achievements === b.achievements &&
  a.quests === b.quests;

/** A point only where the member's own values moved, not where the rest of the guild did. */
export function memberSeries(
  checks: readonly GuildCheck[],
  characterId: string,
): CharacterHistoryPoint[] {
  const points: CharacterHistoryPoint[] = [];
  for (const check of checks) {
    const member = check.members.find((m) => m.characterId === characterId);
    if (member === undefined) continue;
    const point: CharacterHistoryPoint = {
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
    };
    const previous = points.at(-1);
    if (previous === undefined || !sameValues(previous, point))
      points.push(point);
  }
  return points;
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
