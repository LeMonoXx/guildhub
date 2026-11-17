import type { GuildFaction, GuildPartyResponse } from "@guildhub/contracts";
import { rolesOf } from "./class-roles.js";
import type { PartyEntry } from "./party-entry.js";
import { plannedDungeons } from "./party-dungeons.js";
import { focusOf, questAreas, sharedQuests } from "./party-quests.js";

export type {
  PartyEntry,
  PartyMemberFacts,
  PartyProfile,
} from "./party-entry.js";
export { suggestGroup } from "./party-dungeons.js";

export type Party = Omit<GuildPartyResponse, "fetchedAt" | "stale">;

function questsByArea(entries: readonly PartyEntry[]) {
  const byArea = new Map<number, number[]>();
  for (const entry of entries.filter((e) => e.available))
    for (const quest of entry.profile.quests.inProgress) {
      if (quest.areaId === undefined) continue;
      const ids = byArea.get(quest.areaId) ?? [];
      if (!ids.includes(quest.id)) byArea.set(quest.areaId, [...ids, quest.id]);
    }
  return byArea;
}

export function composeParty(input: {
  readonly entries: readonly PartyEntry[];
  readonly faction?: GuildFaction;
}): Party {
  const { entries } = input;
  const areas = questAreas(entries);
  return {
    coverage: {
      members: entries.length,
      profiles: entries.filter((entry) => entry.available).length,
    },
    members: [...entries]
      .sort(
        (a, b) =>
          b.member.level - a.member.level ||
          a.member.name.localeCompare(b.member.name),
      )
      .map((entry) => {
        const focus = focusOf(areas, entry.member.slug);
        const lastLoginAt = entry.profile.summary?.lastLoginAt;
        return {
          slug: entry.member.slug,
          name: entry.member.name,
          surname: entry.member.surname,
          classId: entry.member.classId,
          level: entry.member.level,
          roles: [...rolesOf(entry.member.classId)],
          published: entry.available,
          ...(lastLoginAt === undefined ? {} : { lastLoginAt }),
          ...(entry.profile.avatarUrl === undefined
            ? {}
            : { avatarUrl: entry.profile.avatarUrl }),
          ...(focus === undefined ? {} : { focus }),
        };
      }),
    quests: sharedQuests(entries),
    areas,
    dungeons: plannedDungeons(entries, input.faction, questsByArea(entries)),
  };
}
