import type { PgBoss } from "pg-boss";

export const RECIPE_QUEUE = "refresh-recipes";

/** Recipes change only with game patches; once a week is plenty. */
const WEEKLY = "30 4 * * 1";

/**
 * A rebuild asks Battle.net several thousand times per locale. A small server
 * needs well over pg-boss's default 15 minutes, and an expired job is retried
 * while the first run is still going.
 */
const REBUILD_SECONDS = 3 * 60 * 60;

/**
 * Weekly rebuild, plus one at startup so a fresh install gets its catalog.
 * The startup send is a singleton per day, so restarts do not pile up.
 */
export async function scheduleRecipeCatalog(
  boss: PgBoss,
  timeZone: string,
  today: string,
): Promise<void> {
  if ((await boss.getQueue(RECIPE_QUEUE)) === null)
    await boss.createQueue(RECIPE_QUEUE, {
      policy: "stately",
      expireInSeconds: REBUILD_SECONDS,
    });
  else
    await boss.updateQueue(RECIPE_QUEUE, { expireInSeconds: REBUILD_SECONDS });
  await boss.schedule(RECIPE_QUEUE, WEEKLY, {}, { tz: timeZone });
  await boss.send(
    RECIPE_QUEUE,
    {},
    {
      singletonKey: `recipes-${today}`,
      retryLimit: 3,
      retryDelay: 600,
      retryBackoff: true,
    },
  );
}
