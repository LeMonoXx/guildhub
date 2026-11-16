import type { AchievementRef } from "@guildhub/contracts";
import {
  int,
  isoFromMillis,
  list,
  name,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";
import type { AchievementInfo } from "./battle-net-achievement-catalog.js";

export function mapAchievements(
  value: unknown,
  iconUrl: (iconId: number) => string,
  achievementInfo: ReadonlyMap<number, AchievementInfo> | undefined,
): CharacterProfileData["achievements"] {
  const achievements = rec(value);
  const describe = (id: number, label: string): AchievementRef => {
    const info = achievementInfo?.get(id);
    return {
      id,
      name: label,
      ...optional(
        "iconUrl",
        info?.iconId === undefined ? undefined : iconUrl(info.iconId),
      ),
      ...optional("details", info?.details),
    };
  };
  return {
    total: Math.max(0, int(achievements.total_quantity) ?? 0),
    points: Math.max(0, int(achievements.total_points) ?? 0),
    recent: list(achievements.recent_events).flatMap((event) => {
      const record = rec(event);
      const achievement = rec(record.achievement);
      const id = int(achievement.id);
      const label = str(achievement.name);
      const at = isoFromMillis(record.timestamp);
      if (id === undefined || !label || at === undefined) return [];
      return [{ ...describe(id, label), at }];
    }),
    categories: list(achievements.category_progress).flatMap((entry) => {
      const record = rec(entry);
      const label = name(record.category);
      if (!label) return [];
      return [
        {
          name: label,
          quantity: Math.max(0, int(record.quantity) ?? 0),
          points: Math.max(0, int(record.points) ?? 0),
        },
      ];
    }),
    inProgress: list(achievements.achievements).flatMap((entry) => {
      const record = rec(entry);
      const achievement = rec(record.achievement);
      const id = int(achievement.id);
      const label = str(achievement.name);
      if (id === undefined || !label) return [];
      if (rec(record.criteria).is_completed === true) return [];
      if (record.completed_timestamp !== undefined) return [];
      return [describe(id, label)];
    }),
  };
}
