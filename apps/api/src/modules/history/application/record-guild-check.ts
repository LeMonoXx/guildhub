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
import {
  calendarDay,
  sameState,
  type GuildCheck,
} from "../domain/guild-check.js";
import type { HistoryStore } from "./ports.js";
import { toMemberState } from "./to-member-state.js";

export interface RecordGuildCheckDeps {
  readonly getGuild: GetGuild;
  readonly getRoster: GetGuildRoster;
  readonly loadProfiles: LoadMemberProfiles;
  readonly store: HistoryStore;
  readonly clock: Clock;
  readonly timeZone: string;
  /** Every language the site shows game texts in. */
  readonly locales: readonly ContentLocale[];
}

/** Keeps `observed` when it differs from the latest check, else confirms that one. */
async function keep(
  store: HistoryStore,
  guild: GuildRef,
  observed: GuildCheck & { readonly locale: ContentLocale },
): Promise<GuildCheck> {
  const latest = await store.latest(guild, observed.locale);
  if (latest === undefined || !sameState(latest, observed)) {
    await store.append(guild, observed);
    return observed;
  }
  await store.confirm(guild, latest, observed.checkedAt);
  return { ...latest, checkedAt: observed.checkedAt };
}

/** Checks the guild and every member's published profile, once per language. */
export const makeRecordGuildCheck =
  (deps: RecordGuildCheckDeps) =>
  async (guild: GuildRef): Promise<Result<GuildCheck, GuildSourceError>> => {
    const [profile, roster] = await Promise.all([
      deps.getGuild(guild),
      deps.getRoster(guild),
    ]);
    if (!roster.ok) return roster;
    const now = deps.clock.now();
    const checks = await Promise.all(
      deps.locales.map(async (locale) => {
        const profiles = await deps.loadProfiles(roster.value.data, locale);
        return keep(deps.store, guild, {
          day: calendarDay(now, deps.timeZone),
          locale,
          recordedAt: now,
          checkedAt: now,
          achievementPoints: profile.ok
            ? profile.value.data.achievementPoints
            : 0,
          members: profiles.map(toMemberState),
        });
      }),
    );
    const [check] = checks;
    if (check === undefined) return err(appError("upstream.unavailable"));
    return ok(check);
  };

export type RecordGuildCheck = ReturnType<typeof makeRecordGuildCheck>;
