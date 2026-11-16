import type { QuestLogEntry, QuestRef } from "@guildhub/contracts";
import {
  int,
  list,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";

const RECENT_QUEST_LIMIT = 12;

export interface QuestInfo {
  readonly description?: string;
  readonly area?: string;
  readonly category?: string;
  readonly cadence?: QuestLogEntry["cadence"];
  readonly minLevel?: number;
  readonly experience?: number;
  readonly moneyCopper?: number;
  readonly itemRewards?: readonly string[];
}

export function mapQuestLog(
  quests: unknown,
  completedQuests: unknown,
  questInfo: ReadonlyMap<number, QuestInfo> | undefined,
): CharacterProfileData["quests"] {
  const completed = list(rec(completedQuests).quests);
  return {
    inProgress: questRefs(list(rec(quests).in_progress)).map((quest) =>
      withQuestInfo(quest, questInfo?.get(quest.id)),
    ),
    completedCount: completed.length,
    recentCompleted: questRefs(completed).slice(0, RECENT_QUEST_LIMIT),
  };
}

function questRefs(values: readonly unknown[]): QuestRef[] {
  const seen = new Set<number>();
  return values.flatMap((value) => {
    const record = rec(value);
    const id = int(record.id);
    const label = str(record.name);
    if (id === undefined || id <= 0 || label === undefined || seen.has(id))
      return [];
    seen.add(id);
    return [{ id, name: label }];
  });
}

function withQuestInfo(
  quest: QuestRef,
  info: QuestInfo | undefined,
): QuestLogEntry {
  if (info === undefined) return quest;
  return {
    ...quest,
    ...optional("description", info.description),
    ...optional("area", info.area),
    ...optional("category", info.category),
    ...optional("cadence", info.cadence),
    ...optional("minLevel", info.minLevel),
    ...optional("experience", info.experience),
    ...optional("moneyCopper", info.moneyCopper),
    ...(info.itemRewards === undefined || info.itemRewards.length === 0
      ? {}
      : { itemRewards: [...info.itemRewards] }),
  };
}
