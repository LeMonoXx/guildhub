import { PgBoss } from "pg-boss";
import { toPostgresUrl } from "../../../platform/db/connection-url.js";
import type { ModelBuildQueue } from "../application/ports.js";

export const LOOK_QUEUE = "bake-look";
export const CONVERT_QUEUE = "convert-file";

export function makeNoopModelBuildQueue(): ModelBuildQueue {
  return {
    enqueueLook: () => Promise.resolve(),
    enqueueConvert: () => Promise.resolve(),
  };
}

/** A waiting retry holds the stately singleton, so page polls cannot restart a failing bake. */
const RETRY = { retryLimit: 4, retryDelay: 30, retryBackoff: true } as const;

export function makePgBossModelBuildQueue(boss: PgBoss): ModelBuildQueue {
  return {
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
