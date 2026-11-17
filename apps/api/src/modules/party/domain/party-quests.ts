import type { PartyArea, PartyQuest, QuestLogEntry } from "@guildhub/contracts";
import type { PartyEntry } from "./party-entry.js";

type OpenQuest = QuestLogEntry & { readonly slug: string };

const openQuests = (entries: readonly PartyEntry[]): OpenQuest[] =>
  entries
    .filter((entry) => entry.available)
    .flatMap((entry) =>
      entry.profile.quests.inProgress.map((quest) => ({
        ...quest,
        slug: entry.member.slug,
      })),
    );

const areaKey = (quest: QuestLogEntry): string | undefined =>
  quest.areaId === undefined ? quest.area : `#${String(quest.areaId)}`;

function groupBy<T>(
  values: readonly T[],
  key: (value: T) => string | undefined,
) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const k = key(value);
    if (k === undefined) continue;
    groups.set(k, [...(groups.get(k) ?? []), value]);
  }
  return [...groups.values()];
}

const optionalFacts = (quest: QuestLogEntry) => ({
  ...(quest.area === undefined ? {} : { area: quest.area }),
  ...(quest.areaId === undefined ? {} : { areaId: quest.areaId }),
});

/** Quests two or more members have open at once, most shared first. */
export function sharedQuests(entries: readonly PartyEntry[]): PartyQuest[] {
  return groupBy(openQuests(entries), (quest) => String(quest.id))
    .filter((holders) => holders.length > 1)
    .map((holders) => {
      const [quest] = holders as [OpenQuest, ...OpenQuest[]];
      return {
        id: quest.id,
        name: quest.name,
        ...optionalFacts(quest),
        ...(quest.minLevel === undefined ? {} : { minLevel: quest.minLevel }),
        members: holders.map((holder) => holder.slug),
      };
    })
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        (a.minLevel ?? 0) - (b.minLevel ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

/** Every area with open quests and who has how many there, busiest first. */
export function questAreas(entries: readonly PartyEntry[]): PartyArea[] {
  return groupBy(openQuests(entries), areaKey)
    .map((quests) => {
      const [first] = quests as [OpenQuest, ...OpenQuest[]];
      const counts = new Map<string, number>();
      for (const quest of quests)
        counts.set(quest.slug, (counts.get(quest.slug) ?? 0) + 1);
      return {
        area: first.area ?? "",
        ...(first.areaId === undefined ? {} : { areaId: first.areaId }),
        members: [...counts]
          .map(([slug, count]) => ({ slug, quests: count }))
          .sort((a, b) => b.quests - a.quests),
      };
    })
    .filter((area) => area.area.length > 0)
    .sort(
      (a, b) =>
        totalQuests(b) - totalQuests(a) || b.members.length - a.members.length,
    );
}

const totalQuests = (area: PartyArea): number =>
  area.members.reduce((total, member) => total + member.quests, 0);

/** The area holding most of one member's open quests. */
export function focusOf(
  areas: readonly PartyArea[],
  slug: string,
): Pick<PartyArea, "area" | "areaId"> | undefined {
  let best: { area: PartyArea; quests: number } | undefined;
  for (const area of areas) {
    const quests = area.members.find((m) => m.slug === slug)?.quests ?? 0;
    if (quests > (best?.quests ?? 0)) best = { area, quests };
  }
  if (best === undefined) return undefined;
  return {
    area: best.area.area,
    ...(best.area.areaId === undefined ? {} : { areaId: best.area.areaId }),
  };
}
