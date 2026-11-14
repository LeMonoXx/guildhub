import type { PgBoss } from "pg-boss";

export const RECIPE_QUEUE = "refresh-recipes";

/** Recipes change only with game patches; once a week is plenty. */
const WEEKLY = "30 4 * * 1";

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
    await boss.createQueue(RECIPE_QUEUE, { policy: "stately" });
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
