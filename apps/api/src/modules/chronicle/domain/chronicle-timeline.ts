import type { GuildChronicleResponse } from "@guildhub/contracts";
import { ref, type ChronicleEntry } from "./chronicle-entry.js";

type Timeline = GuildChronicleResponse["timeline"];

const TIMELINE_LIMIT = 40;

/** Recent achievements and last logins of published members, newest first. */
export function composeTimeline(entries: readonly ChronicleEntry[]): Timeline {
  return entries
    .flatMap(memberEvents)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TIMELINE_LIMIT);
}

function memberEvents(entry: ChronicleEntry): Timeline {
  const achievements: Timeline = entry.profile.achievements.recent.map(
    (achievement) => ({
      ...ref(entry),
      kind: "achievement",
      title: achievement.name,
      at: achievement.at,
      ...(achievement.iconUrl === undefined
        ? {}
        : { iconUrl: achievement.iconUrl }),
      ...(achievement.details === undefined
        ? {}
        : { details: achievement.details }),
    }),
  );
  const login = entry.profile.summary?.lastLoginAt;
  if (login === undefined) return achievements;
  return [
    ...achievements,
    { ...ref(entry), kind: "login", title: entry.member.name, at: login },
  ];
}
