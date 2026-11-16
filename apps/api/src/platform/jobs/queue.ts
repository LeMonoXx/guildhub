import { PgBoss } from "pg-boss";
import { toPostgresUrl } from "../db/connection-url.js";

export type { PgBoss } from "pg-boss";

/** What a job handler reports; pino's logger fits it. */
export interface JobLog {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
}

export async function startJobQueue(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: toPostgresUrl(databaseUrl) });
  await boss.start();
  return boss;
}

/**
 * Stately queues hold one waiting and one running job per key, so repeated
 * sends cannot pile up. An existing queue takes the current expiry.
 */
export async function ensureStatelyQueue(
  boss: PgBoss,
  name: string,
  expireInSeconds?: number,
): Promise<void> {
  const expiry = expireInSeconds === undefined ? {} : { expireInSeconds };
  if ((await boss.getQueue(name)) === null)
    await boss.createQueue(name, { policy: "stately", ...expiry });
  else if (expireInSeconds !== undefined) await boss.updateQueue(name, expiry);
}
