import type { Clock } from "../../../platform/kernel/clock.js";
import type { ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { LoadMemberProfiles } from "../../character/index.js";
import type {
  GetGuild,
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
} from "../../guild/index.js";
import { calendarDay, type GuildDay } from "../domain/guild-day.js";
import type { HistoryStore } from "./ports.js";
import { toMemberDay } from "./to-member-day.js";

export interface RecordGuildDayDeps {
  readonly getGuild: GetGuild;
  readonly getRoster: GetGuildRoster;
  readonly loadProfiles: LoadMemberProfiles;
  readonly store: HistoryStore;
  readonly clock: Clock;
  readonly timeZone: string;
  /** Every language the site shows game texts in. */
  readonly locales: readonly ContentLocale[];
}

/** Records today's state of the guild and every member's published profile, once per language. */
export const makeRecordGuildDay =
  (deps: RecordGuildDayDeps) =>
  async (guild: GuildRef): Promise<Result<GuildDay, GuildSourceError>> => {
    const [profile, roster] = await Promise.all([
      deps.getGuild(guild),
      deps.getRoster(guild),
    ]);
    if (!roster.ok) return roster;
    const now = deps.clock.now();
    const days = await Promise.all(
      deps.locales.map(async (locale) => {
        const profiles = await deps.loadProfiles(roster.value.data, locale);
        const day: GuildDay = {
          day: calendarDay(now, deps.timeZone),
          locale,
          recordedAt: now,
          achievementPoints: profile.ok
            ? profile.value.data.achievementPoints
            : 0,
          members: profiles.map(toMemberDay),
        };
        await deps.store.save(guild, day);
        return day;
      }),
    );
    const [day] = days;
    if (day === undefined) return err(appError("upstream.unavailable"));
    return ok(day);
  };

export type RecordGuildDay = ReturnType<typeof makeRecordGuildDay>;
