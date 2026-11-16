import type {
  CharacterHistoryResponse,
  ContentLocale,
  GuildHistoryResponse,
} from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import { publicAvatarUrl } from "../../character/index.js";
import type { GuildRef } from "../../guild/index.js";
import { calendarDay, daysBefore, type GuildDay } from "../domain/guild-day.js";
import { eventsOf, guildSeries, memberSeries } from "../domain/history.js";
import type { HistoryStore } from "./ports.js";

/** Battle.net only renders avatars of characters whose profile is published. */
function eventsWithAvatars(days: readonly GuildDay[]) {
  const published = new Set(
    days.flatMap((day) =>
      day.members.filter((m) => m.published).map((m) => m.slug),
    ),
  );
  return eventsOf(days).map((event) =>
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

/** The window includes one extra day so the oldest shown day can be compared. */
async function window(
  deps: HistoryDeps,
  guild: GuildRef,
  locale: ContentLocale,
) {
  const today = calendarDay(deps.clock.now(), deps.timeZone);
  const [days, since] = await Promise.all([
    deps.store.since(guild, daysBefore(today, HISTORY_WINDOW_DAYS), locale),
    deps.store.firstDay(guild),
  ]);
  const checkedAt = days.at(-1)?.recordedAt.toISOString();
  return {
    days,
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
    const { days, recorded } = await window(deps, guild, locale);
    return {
      ...recorded,
      series: guildSeries(days),
      events: eventsWithAvatars(days).slice(0, GUILD_EVENT_LIMIT),
    };
  };

export const makeGetCharacterHistory =
  (deps: HistoryDeps) =>
  async (query: {
    guild: GuildRef;
    slug: string;
    locale: ContentLocale;
  }): Promise<CharacterHistoryResponse> => {
    const { days, recorded } = await window(deps, query.guild, query.locale);
    const member = days
      .flatMap((day) => day.members)
      .findLast((candidate) => candidate.slug === query.slug);
    const history = {
      ...recorded,
      series: [],
      events: [],
    };
    if (member === undefined) return history;
    return {
      ...history,
      series: memberSeries(days, member.characterId),
      events: eventsWithAvatars(days).filter(
        (event) => event.slug === member.slug,
      ),
    };
  };

export type GetGuildHistory = ReturnType<typeof makeGetGuildHistory>;
export type GetCharacterHistory = ReturnType<typeof makeGetCharacterHistory>;
