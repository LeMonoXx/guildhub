import type { HistoryEvent } from "@guildhub/contracts";
import type { MemberState } from "./guild-check.js";

/** Shirts and tabards change looks, not power; they are not worth a headline. */
const COSMETIC_SLOTS: ReadonlySet<string> = new Set(["SHIRT", "TABARD"]);

export type EventBase = ReturnType<typeof ref> & {
  readonly day: string;
  readonly at: string;
};

export function ref(member: MemberState) {
  return {
    slug: member.slug,
    name: member.name,
    surname: member.surname,
    classId: member.classId,
  };
}

export function rosterChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  return [
    ...(member.level > earlier.level
      ? [
          {
            ...base,
            kind: "level" as const,
            from: earlier.level,
            to: member.level,
          },
        ]
      : []),
    ...(member.rankId === earlier.rankId
      ? []
      : [
          {
            ...base,
            kind: "rank" as const,
            from: earlier.rankId,
            to: member.rankId,
          },
        ]),
  ];
}

/**
 * Changes only a published profile shows. Professions and mounts are compared
 * by name, so they are skipped when the two checks are in different languages.
 */
export function profileChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
  namesComparable: boolean,
): HistoryEvent[] {
  return [
    ...itemChanges(earlier, member, base),
    ...(namesComparable ? professionChanges(earlier, member, base) : []),
    ...reputationChanges(earlier, member, base),
    ...achievementChanges(earlier, member, base),
    ...questChanges(earlier, member, base),
    ...(namesComparable ? mountChanges(earlier, member, base) : []),
  ];
}

/** Checks from before quests were kept have no count to compare with. */
function questChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const from = earlier.questsCompleted;
  const to = member.questsCompleted;
  if (from === undefined || to === undefined || to <= from) return [];
  return [{ ...base, kind: "quests", from, to }];
}

function itemChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const worn = new Map(
    earlier.equipment.map((item) => [item.slot, item.itemId]),
  );
  return member.equipment
    .filter(
      (item) =>
        !COSMETIC_SLOTS.has(item.slot) && worn.get(item.slot) !== item.itemId,
    )
    .map((item) => ({
      ...base,
      kind: "item",
      slot: item.slot,
      itemId: item.itemId,
      item: item.name,
      quality: item.quality,
      ...(item.itemLevel === undefined ? {} : { itemLevel: item.itemLevel }),
      ...(item.iconUrl === undefined ? {} : { iconUrl: item.iconUrl }),
    }));
}

function professionChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const skills = new Map(earlier.professions.map((p) => [p.name, p.skill]));
  return member.professions.flatMap((profession): HistoryEvent[] => {
    const from = skills.get(profession.name) ?? 0;
    if (profession.skill <= from) return [];
    return [
      {
        ...base,
        kind: "profession",
        profession: profession.name,
        from,
        to: profession.skill,
        ...(profession.maxSkill === undefined
          ? {}
          : { maxSkill: profession.maxSkill }),
      },
    ];
  });
}

function reputationChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const tiers = new Map(earlier.reputations.map((r) => [r.factionId, r.tier]));
  return member.reputations.flatMap((reputation): HistoryEvent[] => {
    const from = tiers.get(reputation.factionId);
    if (from === undefined || reputation.tier <= from) return [];
    return [
      {
        ...base,
        kind: "reputation",
        faction: reputation.faction,
        standing: reputation.standing,
        tier: reputation.tier,
      },
    ];
  });
}

/**
 * Each new achievement on its own, at the time it was earned. Checks recorded
 * before achievements were listed only know how many were added.
 */
function achievementChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const gained = member.achievements - earlier.achievements;
  if (gained <= 0) return [];
  if (
    earlier.recentAchievements !== undefined &&
    member.recentAchievements !== undefined
  ) {
    const known = new Set(earlier.recentAchievements.map((a) => a.id));
    return member.recentAchievements
      .filter((achievement) => !known.has(achievement.id))
      .map((achievement) => ({
        ...base,
        at: achievement.at,
        kind: "achievement",
        achievementId: achievement.id,
        achievement: achievement.name,
        ...(achievement.iconUrl === undefined
          ? {}
          : { iconUrl: achievement.iconUrl }),
      }));
  }
  return [
    {
      ...base,
      kind: "achievements",
      count: gained,
      points: Math.max(0, member.achievementPoints - earlier.achievementPoints),
    },
  ];
}

function mountChanges(
  earlier: MemberState,
  member: MemberState,
  base: EventBase,
): HistoryEvent[] {
  const mounts = new Set(earlier.mounts);
  return member.mounts
    .filter((mount) => !mounts.has(mount))
    .map((mount) => ({ ...base, kind: "mount", mount }));
}
