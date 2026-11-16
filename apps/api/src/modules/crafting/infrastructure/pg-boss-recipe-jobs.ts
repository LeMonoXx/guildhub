import {
  ensureStatelyQueue,
  type JobLog,
  type PgBoss,
} from "../../../platform/jobs/queue.js";
import type { RefreshRecipeCatalog } from "../application/refresh-recipe-catalog.js";

export const RECIPE_QUEUE = "refresh-recipes";

/** Recipes change only with game patches; once a week is plenty. */
const WEEKLY = "30 4 * * 1";

/**
 * A rebuild asks Battle.net several thousand times per locale. A small server
 * needs well over pg-boss's default 15 minutes, and an expired job is retried
 * while the first run is still going.
 */
const REBUILD_SECONDS = 3 * 60 * 60;

export interface RecipeJobs {
  readonly refreshRecipes: RefreshRecipeCatalog;
  readonly timeZone: string;
  /** The calendar day the worker starts on, in `timeZone`. */
  readonly today: string;
  readonly log: JobLog;
}

/**
 * Weekly rebuild, plus one at startup so a fresh install gets its catalog.
 * The startup send is a singleton per day, so restarts do not pile up.
 */
export async function registerRecipeJobs(
  boss: PgBoss,
  jobs: RecipeJobs,
): Promise<void> {
  await ensureStatelyQueue(boss, RECIPE_QUEUE, REBUILD_SECONDS);
  await boss.schedule(RECIPE_QUEUE, WEEKLY, {}, { tz: jobs.timeZone });
  await boss.send(
    RECIPE_QUEUE,
    {},
    {
      singletonKey: `recipes-${jobs.today}`,
      retryLimit: 3,
      retryDelay: 600,
      retryBackoff: true,
    },
  );
  await boss.work(RECIPE_QUEUE, async () => {
    const refreshed = await jobs.refreshRecipes();
    if (!refreshed.ok) {
      jobs.log.warn(
        {
          module: "crafting",
          code: refreshed.error.code,
          detail: refreshed.error.detail,
        },
        "recipe catalog not refreshed",
      );
      throw new Error(`recipe catalog not refreshed: ${refreshed.error.code}`);
    }
    jobs.log.info(
      { module: "crafting", recipes: refreshed.value.recipes },
      "recipe catalog refreshed",
    );
  });
}
