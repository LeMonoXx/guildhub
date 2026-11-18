import type { GuildChronicleResponse } from "@guildhub/contracts";
import { sum, type ChronicleEntry } from "./chronicle-entry.js";
import { composeDossier } from "./chronicle-dossiers.js";
import {
  composeBestiary,
  composeHallOfFame,
  composeProfessions,
} from "./chronicle-rolls.js";
import { composeMakeup, composeTotals } from "./chronicle-totals.js";

export type {
  ChronicleEntry,
  ChronicleMember,
  ChronicleProfile,
} from "./chronicle-entry.js";
export {
  BOSS_KILLS_STATISTIC_GROUP,
  splitBossStatistic,
} from "./chronicle-rolls.js";

export type Chronicle = Omit<GuildChronicleResponse, "fetchedAt" | "stale">;

export function composeChronicle(input: {
  entries: readonly ChronicleEntry[];
  createdAt?: string;
}): Chronicle {
  const { entries } = input;
  const published = entries.filter((entry) => entry.available);
  const bestiary = composeBestiary(published);
  return {
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    coverage: { members: entries.length, profiles: published.length },
    totals: composeTotals(entries, sum(bestiary.map((boss) => boss.kills))),
    ...composeMakeup(entries),
    professions: composeProfessions(published),
    bestiary,
    hallOfFame: composeHallOfFame(entries),
    dossiers: entries.map(composeDossier),
  };
}
