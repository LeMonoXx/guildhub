import {
  ensureStatelyQueue,
  type JobLog,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type { GuildRef } from "../../guild/index.js";
import type { RecordGuildCheck } from "../application/record-guild-check.js";

export const HISTORY_QUEUE = "record-history";

export interface HistoryJobs {
  readonly guild: GuildRef;
  readonly recordGuildCheck: RecordGuildCheck;
  readonly cron: string;
  readonly timeZone: string;
  /** The calendar day the worker starts on, in `timeZone`. */
  readonly today: string;
  readonly log: JobLog;
}

/**
 * The cron checks the guild every hour. A startup send covers a worker that
 * was down. A check that finds nothing new only confirms the latest one.
 */
export async function registerHistoryJobs(
  boss: PgBoss,
  jobs: HistoryJobs,
): Promise<void> {
  await ensureStatelyQueue(boss, HISTORY_QUEUE);
  await boss.schedule(HISTORY_QUEUE, jobs.cron, {}, { tz: jobs.timeZone });
  await boss.send(
    HISTORY_QUEUE,
    {},
    {
      singletonKey: jobs.today,
      retryLimit: 4,
      retryDelay: 300,
      retryBackoff: true,
    },
  );
  await boss.work(HISTORY_QUEUE, async () => {
    const recorded = await jobs.recordGuildCheck(jobs.guild);
    if (!recorded.ok) {
      jobs.log.warn(
        { module: "history", code: recorded.error.code },
        "guild check failed",
      );
      throw new Error(`guild check failed: ${recorded.error.code}`);
    }
    jobs.log.info(
      {
        module: "history",
        day: recorded.value.day,
        members: recorded.value.members.length,
      },
      "guild checked",
    );
  });
}
