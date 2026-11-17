import type { ContentLocale, HistoryEvent } from "@guildhub/contracts";
import { celebrationsOf } from "../domain/celebration.js";
import type { CelebrationNotifier } from "./ports.js";

export interface AnnounceCelebrationsDeps {
  readonly notifier: CelebrationNotifier;
  /** The language the channel reads; checks in other languages repeat the same changes. */
  readonly locale: ContentLocale;
}

/** Announces the milestones among a check's changes and returns how many it posted. */
export const makeAnnounceCelebrations =
  ({ notifier, locale }: AnnounceCelebrationsDeps) =>
  async (
    events: readonly HistoryEvent[],
    eventLocale: ContentLocale,
  ): Promise<number> => {
    if (eventLocale !== locale) return 0;
    const celebrations = celebrationsOf(events);
    if (celebrations.length === 0) return 0;
    await notifier.announce(celebrations);
    return celebrations.length;
  };

export type AnnounceCelebrations = ReturnType<typeof makeAnnounceCelebrations>;
