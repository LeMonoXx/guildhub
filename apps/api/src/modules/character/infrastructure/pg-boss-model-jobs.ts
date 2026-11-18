import {
  ensureStatelyQueue,
  type JobLog,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type {
  BakeLook,
  LookRebakeSummary,
  makePrebakeBodies,
  makeRebakeLooks,
  PrebakeSummary,
} from "../application/bake-models.js";
import type { ConvertFileJob } from "../application/ports.js";
import type { LookBakeDocument } from "../domain/look.js";
import {
  CONVERT_QUEUE,
  LOOK_QUEUE,
  ensureModelQueues,
} from "./pg-boss-model-build-queue.js";

export const PREBAKE_QUEUE = "prebake-bodies";

/** After European maintenance; an unchanged build answers from the ledger alone. */
const DAILY = "17 11 * * *";
/** Every playable body of a fresh build, one after another, on a small host. */
const PREBAKE_SECONDS = 4 * 60 * 60;

export interface ModelJobs {
  readonly bakeLook: BakeLook;
  readonly bakeFile: (job: ConvertFileJob) => Promise<void>;
  readonly prebakeBodies: ReturnType<typeof makePrebakeBodies>;
  readonly rebakeLooks: ReturnType<typeof makeRebakeLooks>;
  /** True once the worker shuts down; a prebake ends between bodies or looks. */
  readonly stopping: () => boolean;
  readonly timeZone: string;
  readonly log: JobLog;
}

/**
 * Look, file, and prebake jobs; prebakes run daily and once at startup. A new
 * game build bakes every body, then every member's look, then goes live.
 */
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
    logBodies(jobs.log, summary.value);
    logLooks(jobs.log, await jobs.rebakeLooks(jobs.stopping));
  });
  await boss.schedule(PREBAKE_QUEUE, DAILY, {}, { tz: jobs.timeZone });
  await boss.send(PREBAKE_QUEUE, {});
}

function logBodies(log: JobLog, summary: PrebakeSummary): void {
  const { build, current, races, baked, failed } = summary;
  if (current) {
    log.info({ module: "baker", build }, "game build unchanged");
    return;
  }
  for (const failure of failed)
    log.warn({ module: "baker", build, ...failure }, "prebake failed");
  log.info(
    { module: "baker", build, races, baked, failed: failed.length },
    "bodies prebaked",
  );
}

function logLooks(log: JobLog, summary: LookRebakeSummary): void {
  const { build, current, looks, baked, failed, published } = summary;
  if (current) return;
  for (const failure of failed)
    log.warn({ module: "baker", build, ...failure }, "look rebake failed");
  log.info(
    { module: "baker", build, looks, baked, failed: failed.length, published },
    published ? "game build published" : "look rebake stopped",
  );
}
