import type { ContentLocale, ItemQuality } from "@guildhub/contracts";

/** What one member looked like when the day was recorded. */
export interface MemberDay {
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

/** One recorded day of the guild. Recording the same day again replaces it. */
/** Days recorded before languages were kept are English. */
export const legacyDayLocale: ContentLocale = "en";

export interface GuildDay {
  readonly day: string;
  /** The language of the game texts, `legacyDayLocale` when not recorded. */
  readonly locale?: ContentLocale;
  readonly recordedAt: Date;
  readonly achievementPoints: number;
  readonly members: readonly MemberDay[];
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
