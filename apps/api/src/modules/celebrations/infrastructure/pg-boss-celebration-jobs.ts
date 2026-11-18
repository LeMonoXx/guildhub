import type { JobLog, PgBoss } from "../../../platform/jobs/queue.js";
import type {
  CelebrationNotifier,
  CelebrationQueue,
} from "../application/ports.js";
import type { Celebration } from "../domain/celebration.js";

export const CELEBRATION_QUEUE = "announce-celebrations";

interface CelebrationPost {
  readonly celebrations: readonly Celebration[];
}

export interface CelebrationJobs {
  readonly notifier: CelebrationNotifier;
  readonly log: JobLog;
}

/**
 * Delivers each post from a queue, so a channel that is down or rate limited
 * gets the post again later instead of losing it.
 */
export async function registerCelebrationJobs(
  boss: PgBoss,
  { notifier, log }: CelebrationJobs,
): Promise<CelebrationQueue> {
  if ((await boss.getQueue(CELEBRATION_QUEUE)) === null)
    await boss.createQueue(CELEBRATION_QUEUE);
  await boss.work<CelebrationPost>(CELEBRATION_QUEUE, async (batch) => {
    for (const job of batch) {
      await notifier.announce(job.data.celebrations);
      log.info(
        { module: "celebrations", count: job.data.celebrations.length },
        "celebrations posted",
      );
    }
  });
  return {
    async enqueue(celebrations) {
      await boss.send(
        CELEBRATION_QUEUE,
        { celebrations },
        { retryLimit: 8, retryDelay: 60, retryBackoff: true },
      );
    },
  };
}
