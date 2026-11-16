import type { HistoryEvent } from "@guildhub/contracts";

export type HistoryEventOf<K extends HistoryEvent["kind"]> = Extract<
  HistoryEvent,
  { kind: K }
>;

export const historyGlyphs: Readonly<Record<HistoryEvent["kind"], string>> = {
  joined: "✦",
  left: "✧",
  level: "▲",
  rank: "♛",
  item: "⚔",
  profession: "⚒",
  reputation: "❖",
  achievements: "★",
  mount: "♞",
};

export const achievementsKey = (event: HistoryEventOf<"achievements">) => {
  if (event.points > 0) return "history.event.achievements";
  return event.count === 1
    ? "history.event.achievementOne"
    : "history.event.achievementsCount";
};
