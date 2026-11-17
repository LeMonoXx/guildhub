import type {
  CharacterHistoryResponse,
  ContentLocale,
  GuildHistoryResponse,
} from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import { publicAvatarUrl } from "../../character/index.js";
import type { GuildRef } from "../../guild/index.js";
import {
  calendarDay,
  daysBefore,
  type GuildCheck,
} from "../domain/guild-check.js";
import { eventsOf, guildSeries, memberSeries } from "../domain/history.js";
import type { HistoryStore } from "./ports.js";

/** Battle.net only renders avatars of characters whose profile is published. */
function eventsWithAvatars(checks: readonly GuildCheck[]) {
  const published = new Set(
    checks.flatMap((check) =>
      check.members.filter((m) => m.published).map((m) => m.slug),
    ),
  );
  return eventsOf(checks).map((event) =>
    published.has(event.slug)
      ? { ...event, avatarUrl: publicAvatarUrl(event.slug) }
      : event,
  );
}

export const HISTORY_WINDOW_DAYS = 90;
const GUILD_EVENT_LIMIT = 120;

export interface HistoryDeps {
  readonly store: HistoryStore;
  readonly clock: Clock;
  readonly timeZone: string;
}

/** The oldest check in the window is the baseline the next one is compared with. */
async function window(
  deps: HistoryDeps,
  guild: GuildRef,
  locale: ContentLocale,
) {
  const today = calendarDay(deps.clock.now(), deps.timeZone);
  const [checks, since] = await Promise.all([
    deps.store.since(guild, daysBefore(today, HISTORY_WINDOW_DAYS), locale),
    deps.store.firstDay(guild),
  ]);
  const checkedAt = checks.at(-1)?.checkedAt.toISOString();
  return {
    checks,
    recorded: {
      ...(since === undefined ? {} : { since }),
      ...(checkedAt === undefined ? {} : { checkedAt }),
    },
  };
}

export const makeGetGuildHistory =
  (deps: HistoryDeps) =>
  async (
    guild: GuildRef,
    locale: ContentLocale,
  ): Promise<GuildHistoryResponse> => {
    const { checks, recorded } = await window(deps, guild, locale);
    return {
      ...recorded,
      series: guildSeries(checks),
      events: eventsWithAvatars(checks).slice(0, GUILD_EVENT_LIMIT),
    };
  };

export const makeGetCharacterHistory =
  (deps: HistoryDeps) =>
  async (query: {
    guild: GuildRef;
    slug: string;
    locale: ContentLocale;
  }): Promise<CharacterHistoryResponse> => {
    const { checks, recorded } = await window(deps, query.guild, query.locale);
    const member = checks
      .flatMap((check) => check.members)
      .findLast((candidate) => candidate.slug === query.slug);
    const history = {
      ...recorded,
      series: [],
      events: [],
    };
    if (member === undefined) return history;
    return {
      ...history,
      series: memberSeries(checks, member.characterId),
      events: eventsWithAvatars(checks).filter(
        (event) => event.slug === member.slug,
      ),
    };
  };

export type GetGuildHistory = ReturnType<typeof makeGetGuildHistory>;
export type GetCharacterHistory = ReturnType<typeof makeGetCharacterHistory>;
