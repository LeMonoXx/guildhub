import type { PgBoss } from "pg-boss";

export const HISTORY_QUEUE = "record-history";

export interface HistorySchedule {
  readonly cron: string;
  readonly timeZone: string;
}

/**
 * The cron keeps the daily rhythm; the startup send records a day the worker
 * was down for. Recording a day again replaces it.
 */
export async function scheduleHistory(
  boss: PgBoss,
  schedule: HistorySchedule,
  today: string,
): Promise<void> {
  if ((await boss.getQueue(HISTORY_QUEUE)) === null)
    await boss.createQueue(HISTORY_QUEUE, { policy: "stately" });
  await boss.schedule(
    HISTORY_QUEUE,
    schedule.cron,
    {},
    { tz: schedule.timeZone },
  );
  await boss.send(
    HISTORY_QUEUE,
    {},
    {
      singletonKey: today,
      retryLimit: 4,
      retryDelay: 300,
      retryBackoff: true,
    },
  );
}
