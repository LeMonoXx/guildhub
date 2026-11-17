import type { ContentLocale, ItemQuality } from "@guildhub/contracts";

/** What one member looked like at a check. */
export interface MemberState {
  readonly characterId: string;
  readonly slug: string;
  readonly name: string;
  readonly surname: string;
  readonly classId: string;
  readonly level: number;
  readonly rankId: number;
  /** Battle.net publishes the profile; the fields below are empty otherwise. */
  readonly published: boolean;
  readonly itemLevel?: number;
  readonly achievementPoints: number;
  readonly achievements: number;
  /** Absent in checks recorded before quests were kept. */
  readonly questsCompleted?: number;
  readonly equipment: readonly {
    readonly slot: string;
    readonly itemId: number;
    readonly name: string;
    readonly quality: ItemQuality;
    readonly itemLevel?: number;
    readonly iconUrl?: string;
  }[];
  readonly professions: readonly {
    readonly name: string;
    readonly skill: number;
    readonly maxSkill?: number;
  }[];
  readonly reputations: readonly {
    readonly factionId: number;
    readonly faction: string;
    readonly standing: string;
    readonly tier: number;
  }[];
  readonly mounts: readonly string[];
}

/** Checks recorded before languages were kept are English. */
export const legacyCheckLocale: ContentLocale = "en";

/**
 * One distinct state of the guild. An hourly check that finds nothing new
 * only moves `checkedAt`; any difference starts a new check.
 */
export interface GuildCheck {
  /** The calendar day of `recordedAt` in the guild's time zone. */
  readonly day: string;
  /** The language of the game texts, `legacyCheckLocale` when not recorded. */
  readonly locale?: ContentLocale;
  /** When this state was first seen. */
  readonly recordedAt: Date;
  /** When an hourly check last confirmed this state. */
  readonly checkedAt: Date;
  readonly achievementPoints: number;
  readonly members: readonly MemberState[];
}

const byCharacter = (members: readonly MemberState[]) =>
  [...members].sort((a, b) => a.characterId.localeCompare(b.characterId));

/** Whether two checks saw the same guild, ignoring roster order and times. */
export function sameState(
  earlier: Pick<GuildCheck, "achievementPoints" | "members">,
  later: Pick<GuildCheck, "achievementPoints" | "members">,
): boolean {
  return (
    earlier.achievementPoints === later.achievementPoints &&
    JSON.stringify(byCharacter(earlier.members)) ===
      JSON.stringify(byCharacter(later.members))
  );
}

/** The calendar day of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function calendarDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The day `days` before `day`, both `YYYY-MM-DD`. */
export function daysBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
