import {
  ensureStatelyQueue,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type { ModelBuildQueue } from "../application/ports.js";

export const LOOK_QUEUE = "bake-look";
export const CONVERT_QUEUE = "convert-file";

export function makeNoopModelBuildQueue(): ModelBuildQueue {
  return {
    enqueueLook: () => Promise.resolve(),
    enqueueConvert: () => Promise.resolve(),
    queuedLooks: () => Promise.resolve([]),
  };
}

/** A waiting retry holds the stately singleton, so page polls cannot restart a failing bake. */
const RETRY = { retryLimit: 4, retryDelay: 30, retryBackoff: true } as const;

/** One roster asks for every member's place at once; one read answers them all. */
const QUEUE_READ_MS = 3000;

export function makePgBossModelBuildQueue(
  boss: PgBoss,
  now: () => number = Date.now,
): ModelBuildQueue {
  let queued: { at: number; hashes: Promise<readonly string[]> } | undefined;
  return {
    queuedLooks: () => {
      if (queued === undefined || now() - queued.at > QUEUE_READ_MS) {
        const hashes = boss
          .findJobs<{ lookHash?: unknown }>(LOOK_QUEUE, { queued: true })
          .then((jobs) =>
            jobs.flatMap((job) =>
              typeof job.data.lookHash === "string" ? [job.data.lookHash] : [],
            ),
          )
          .catch(() => []);
        queued = { at: now(), hashes };
      }
      return queued.hashes;
    },
    enqueueLook: async (job) => {
      await boss.send(LOOK_QUEUE, job, {
        ...RETRY,
        singletonKey: job.lookHash,
      });
    },
    enqueueConvert: async (job) => {
      await boss.send(CONVERT_QUEUE, job, {
        ...RETRY,
        singletonKey: `${job.build}:${String(job.outputVersion)}:${String(job.fileId)}`,
      });
    },
  };
}

/** The API enqueues into these, so it creates them as the worker does. */
export async function ensureModelQueues(boss: PgBoss): Promise<void> {
  await ensureStatelyQueue(boss, LOOK_QUEUE);
  await ensureStatelyQueue(boss, CONVERT_QUEUE);
}
