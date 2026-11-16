import type { GuildChronicleResponse } from "@guildhub/contracts";
import {
  honorableKills,
  itemLevel,
  questsCompleted,
  ref,
  type ChronicleEntry,
} from "./chronicle-entry.js";

type Dossier = GuildChronicleResponse["dossiers"][number];

/** One card per member, whether or not the profile is published. */
export function composeDossier(entry: ChronicleEntry): Dossier {
  const { member, profile } = entry;
  const summary = profile.summary;
  const spec = [...profile.specializations].sort(
    (a, b) => b.spentPoints - a.spentPoints,
  )[0];
  const averageItemLevel = itemLevel(entry);
  return {
    ...ref(entry),
    characterId: member.characterId,
    status: entry.available ? "available" : "unavailable",
    level: member.level,
    ...(averageItemLevel === undefined ? {} : { averageItemLevel }),
    ...(summary?.lastLoginAt === undefined
      ? {}
      : { lastLoginAt: summary.lastLoginAt }),
    achievementPoints: summary?.achievementPoints ?? 0,
    questsCompleted: questsCompleted(entry),
    honorableKills: honorableKills(entry),
    mounts: profile.collections.mounts.length,
    ...(spec === undefined || spec.spentPoints === 0
      ? {}
      : { specialization: spec.name }),
    professions: profile.professions.map((profession) => ({
      name: profession.name,
      skill: profession.skill,
      maxSkill: profession.maxSkill,
    })),
    ...(profile.avatarUrl === undefined
      ? {}
      : { avatarUrl: profile.avatarUrl }),
  };
}
