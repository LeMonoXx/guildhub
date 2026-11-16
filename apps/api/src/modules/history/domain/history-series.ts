import type {
  CharacterHistoryPoint,
  GuildHistoryPoint,
} from "@guildhub/contracts";
import type { GuildDay } from "./guild-day.js";

export function guildSeries(days: readonly GuildDay[]): GuildHistoryPoint[] {
  return days.map((day) => {
    const itemLevels = day.members.flatMap((m) =>
      m.itemLevel === undefined ? [] : [m.itemLevel],
    );
    return {
      day: day.day,
      members: day.members.length,
      averageLevel: round(average(day.members.map((m) => m.level)) ?? 0),
      ...(itemLevels.length === 0
        ? {}
        : { averageItemLevel: round(average(itemLevels) ?? 0) }),
      achievements: day.members.reduce(
        (total, member) => total + member.achievements,
        0,
      ),
    };
  });
}

export function memberSeries(
  days: readonly GuildDay[],
  characterId: string,
): CharacterHistoryPoint[] {
  return days.flatMap((day) => {
    const member = day.members.find((m) => m.characterId === characterId);
    if (member === undefined) return [];
    return [
      {
        day: day.day,
        level: member.level,
        ...(member.itemLevel === undefined
          ? {}
          : { itemLevel: member.itemLevel }),
        achievements: member.achievements,
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
