import {
  ensureStatelyQueue,
  type JobLog,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type {
  BakeLook,
  makePrebakeBodies,
} from "../application/bake-models.js";
import type { ConvertFileJob } from "../application/ports.js";
import type { LookBakeDocument } from "../domain/look.js";
import {
  CONVERT_QUEUE,
  LOOK_QUEUE,
  ensureModelQueues,
} from "./pg-boss-model-build-queue.js";

export const PREBAKE_QUEUE = "prebake-bodies";

/** A new game build shows up within the hour; an unchanged one is a cheap check. */
const HOURLY = "17 * * * *";
/** Every playable body of a fresh build, one after another, on a small host. */
const PREBAKE_SECONDS = 4 * 60 * 60;

export interface ModelJobs {
  readonly bakeLook: BakeLook;
  readonly bakeFile: (job: ConvertFileJob) => Promise<void>;
  readonly prebakeBodies: ReturnType<typeof makePrebakeBodies>;
  /** True once the worker shuts down; a prebake ends between bodies. */
  readonly stopping: () => boolean;
  readonly timeZone: string;
  readonly log: JobLog;
}

/** Look, file, and prebake jobs; prebakes run hourly and once at startup. */
export async function registerModelJobs(
  boss: PgBoss,
  jobs: ModelJobs,
): Promise<void> {
  await ensureModelQueues(boss);
  await ensureStatelyQueue(boss, PREBAKE_QUEUE, PREBAKE_SECONDS);
  await boss.work<LookBakeDocument>(LOOK_QUEUE, async (batch) => {
    for (const job of batch) {
      const started = Date.now();
      await jobs.bakeLook(job.data);
      jobs.log.info(
        {
          module: "baker",
          lookHash: job.data.lookHash,
          ms: Date.now() - started,
        },
        "look baked",
      );
    }
  });
  await boss.work<ConvertFileJob>(CONVERT_QUEUE, async (batch) => {
    for (const job of batch) await jobs.bakeFile(job.data);
  });
  await boss.work(PREBAKE_QUEUE, async () => {
    const summary = await jobs.prebakeBodies(jobs.stopping);
    if (!summary.ok) {
      jobs.log.warn(
        {
          module: "baker",
          code: summary.error.code,
          detail: summary.error.detail,
        },
        "playable races unavailable",
      );
      throw new Error(`playable races unavailable: ${summary.error.code}`);
    }
    for (const failure of summary.value.failed)
      jobs.log.warn({ module: "baker", ...failure }, "prebake failed");
    if (summary.value.baked > 0 || summary.value.failed.length > 0)
      jobs.log.info(
        {
          module: "baker",
          races: summary.value.races,
          baked: summary.value.baked,
          failed: summary.value.failed.length,
        },
        "bodies prebaked",
      );
  });
  await boss.schedule(PREBAKE_QUEUE, HOURLY, {}, { tz: jobs.timeZone });
  await boss.send(PREBAKE_QUEUE, {});
}
