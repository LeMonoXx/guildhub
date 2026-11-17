import type { ContentLocale } from "@guildhub/contracts";
import type { GuildRef } from "../../guild/index.js";
import type { GuildCheck } from "../domain/guild-check.js";

export interface HistoryStore {
  /** The newest check in `locale`, if any. */
  latest(
    guild: GuildRef,
    locale: ContentLocale,
  ): Promise<GuildCheck | undefined>;
  /** Keeps a new state next to every earlier one. */
  append(guild: GuildRef, check: GuildCheck): Promise<void>;
  /** Notes that an hourly check at `checkedAt` still saw `check`. */
  confirm(guild: GuildRef, check: GuildCheck, checkedAt: Date): Promise<void>;
  /**
   * Checks still current on or after `fromDay`, oldest first, in `locale`;
   * English fills the time before the first check in `locale`.
   */
  since(
    guild: GuildRef,
    fromDay: string,
    locale: ContentLocale,
  ): Promise<GuildCheck[]>;
  /** The day of the first check, if any. */
  firstDay(guild: GuildRef): Promise<string | undefined>;
}
