import { PgBoss } from "pg-boss";
import { toPostgresUrl } from "../../../platform/db/connection-url.js";
import type { ModelBuildQueue } from "../application/ports.js";

export const LOOK_QUEUE = "bake-look";
export const CONVERT_QUEUE = "convert-file";
export const PREBAKE_QUEUE = "prebake-bodies";

/** A new game build shows up within the hour; an unchanged one is a cheap check. */
const HOURLY = "17 * * * *";
/** Every playable body of a fresh build, one after another, on a small host. */
const PREBAKE_SECONDS = 4 * 60 * 60;

/** Hourly, plus once at startup so a fresh install starts right away. */
export async function schedulePrebake(
  boss: PgBoss,
  timeZone: string,
): Promise<void> {
  if ((await boss.getQueue(PREBAKE_QUEUE)) === null)
    await boss.createQueue(PREBAKE_QUEUE, {
      policy: "stately",
      expireInSeconds: PREBAKE_SECONDS,
    });
  await boss.schedule(PREBAKE_QUEUE, HOURLY, {}, { tz: timeZone });
  await boss.send(PREBAKE_QUEUE, {});
}

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

export async function startJobQueue(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: toPostgresUrl(databaseUrl) });
  await boss.start();
  await ensureQueue(boss, LOOK_QUEUE);
  await ensureQueue(boss, CONVERT_QUEUE);
  return boss;
}

async function ensureQueue(boss: PgBoss, name: string): Promise<void> {
  if ((await boss.getQueue(name)) !== null) return;
  await boss.createQueue(name, { policy: "stately" });
}
