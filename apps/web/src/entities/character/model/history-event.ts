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
  quests: "❢",
};

export const achievementsKey = (event: HistoryEventOf<"achievements">) => {
  if (event.points > 0) return "history.event.achievements";
  return event.count === 1
    ? "history.event.achievementOne"
    : "history.event.achievementsCount";
};

export const questsKey = (event: HistoryEventOf<"quests">) =>
  event.to - event.from === 1
    ? "history.event.questOne"
    : "history.event.quests";
