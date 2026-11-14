import type { ContentLocale } from "@guildhub/contracts";
import type { GuildRef } from "../../guild/index.js";
import type { GuildDay } from "../domain/guild-day.js";

export interface HistoryStore {
  /** Writes the day, replacing an earlier recording of the same day. */
  save(guild: GuildRef, day: GuildDay): Promise<void>;
  /** Recorded days from `fromDay` on, oldest first, in `locale` where recorded so, else English. */
  since(
    guild: GuildRef,
    fromDay: string,
    locale: ContentLocale,
  ): Promise<GuildDay[]>;
  /** The first recorded day, if any. */
  firstDay(guild: GuildRef): Promise<string | undefined>;
}
