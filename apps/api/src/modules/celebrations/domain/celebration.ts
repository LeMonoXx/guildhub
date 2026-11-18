import type { HistoryEvent } from "@guildhub/contracts";

export const LEVEL_CAP = 60;
export const PROFESSION_MILESTONES = [150, 225, 300] as const;
/** Battle.net's reputation tiers run from 0 (Hated) to 7 (Exalted); 6 is Revered. */
export const REVERED_TIER = 6;

export interface CelebratedMember {
  readonly slug: string;
  readonly name: string;
  readonly classId: string;
}

/** One moment the guild channel should cheer for. */
export type Celebration = { readonly member: CelebratedMember } & (
  | { readonly kind: "levelCap"; readonly level: number }
  | {
      readonly kind: "profession";
      readonly profession: string;
      readonly milestone: number;
    }
  | {
      readonly kind: "reputation";
      readonly faction: string;
      readonly standing: string;
      readonly tier: number;
    }
  | {
      readonly kind: "achievements";
      readonly count: number;
      readonly points: number;
    }
  | {
      readonly kind: "achievement";
      readonly achievement: string;
      readonly iconUrl?: string;
    }
);

type EventOf<K extends HistoryEvent["kind"]> = Extract<
  HistoryEvent,
  { kind: K }
>;

type Selectors = {
  readonly [K in HistoryEvent["kind"]]?: (
    event: EventOf<K>,
    member: CelebratedMember,
  ) => Celebration[];
};

const selectors: Selectors = {
  level: (event, member) =>
    event.from < LEVEL_CAP && event.to >= LEVEL_CAP
      ? [{ kind: "levelCap", member, level: event.to }]
      : [],
  profession: (event, member) =>
    PROFESSION_MILESTONES.filter(
      (milestone) => event.from < milestone && event.to >= milestone,
    )
      .slice(-1)
      .map((milestone) => ({
        kind: "profession",
        member,
        profession: event.profession,
        milestone,
      })),
  reputation: (event, member) =>
    event.tier >= REVERED_TIER
      ? [
          {
            kind: "reputation",
            member,
            faction: event.faction,
            standing: event.standing,
            tier: event.tier,
          },
        ]
      : [],
  achievements: (event, member) => [
    { kind: "achievements", member, count: event.count, points: event.points },
  ],
  achievement: (event, member) => [
    {
      kind: "achievement",
      member,
      achievement: event.achievement,
      ...(event.iconUrl === undefined ? {} : { iconUrl: event.iconUrl }),
    },
  ],
};

function celebrate(event: HistoryEvent): Celebration[] {
  const select = selectors[event.kind] as
    | ((event: HistoryEvent, member: CelebratedMember) => Celebration[])
    | undefined;
  return (
    select?.(event, {
      slug: event.slug,
      name: event.name,
      classId: event.classId,
    }) ?? []
  );
}

/** The changes of one check worth a shout-out, in the order they happened. */
export function celebrationsOf(events: readonly HistoryEvent[]): Celebration[] {
  return events.flatMap(celebrate);
}
