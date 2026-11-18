import type { ContentLocale, HistoryEvent } from "@guildhub/contracts";
import { celebrationsOf } from "../domain/celebration.js";
import type { CelebrationQueue } from "./ports.js";

export interface AnnounceCelebrationsDeps {
  readonly queue: CelebrationQueue;
  /** The most celebrations one post may carry. */
  readonly batchSize: number;
  /** The language the channel reads; checks in other languages repeat the same changes. */
  readonly locale: ContentLocale;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/**
 * Queues the milestones among a check's changes, one post per batch so a
 * retry never repeats a post the channel already took. Returns how many.
 */
export const makeAnnounceCelebrations =
  ({ queue, batchSize, locale }: AnnounceCelebrationsDeps) =>
  async (
    events: readonly HistoryEvent[],
    eventLocale: ContentLocale,
  ): Promise<number> => {
    if (eventLocale !== locale) return 0;
    const celebrations = celebrationsOf(events);
    for (const batch of chunks(celebrations, batchSize))
      await queue.enqueue(batch);
    return celebrations.length;
  };

export type AnnounceCelebrations = ReturnType<typeof makeAnnounceCelebrations>;
