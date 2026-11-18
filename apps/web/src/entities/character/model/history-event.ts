import type { EquippedItem, HistoryEvent } from "@guildhub/contracts";

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
  achievement: "★",
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

/** The tooltip a gear change can show before the item's full data arrives. */
export const itemOfEvent = (
  event: HistoryEventOf<"item">,
  slotName: string,
): EquippedItem => ({
  slot: event.slot,
  slotName,
  itemId: event.itemId,
  name: event.item,
  quality: event.quality,
  qualityName: event.quality,
  ...(event.itemLevel === undefined ? {} : { itemLevel: event.itemLevel }),
  ...(event.iconUrl === undefined ? {} : { iconUrl: event.iconUrl }),
  stats: [],
  enchantments: [],
  quantity: 1,
});
