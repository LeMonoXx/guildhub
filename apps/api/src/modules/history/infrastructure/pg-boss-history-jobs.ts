import {
  ensureStatelyQueue,
  type JobLog,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type { GuildRef } from "../../guild/index.js";
import type { RecordGuildDay } from "../application/record-guild-day.js";

export const HISTORY_QUEUE = "record-history";

export interface HistoryJobs {
  readonly guild: GuildRef;
  readonly recordGuildDay: RecordGuildDay;
  readonly cron: string;
  readonly timeZone: string;
  /** The calendar day the worker starts on, in `timeZone`. */
  readonly today: string;
  readonly log: JobLog;
}

/**
 * The cron refreshes today's record. A startup send covers a worker that was
 * down. Recording a day again replaces it. The chronicle compares days.
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
    const recorded = await jobs.recordGuildDay(jobs.guild);
    if (!recorded.ok) {
      jobs.log.warn(
        { module: "history", code: recorded.error.code },
        "guild day not recorded",
      );
      throw new Error(`guild day not recorded: ${recorded.error.code}`);
    }
    jobs.log.info(
      {
        module: "history",
        day: recorded.value.day,
        members: recorded.value.members.length,
      },
      "guild day recorded",
    );
  });
}
