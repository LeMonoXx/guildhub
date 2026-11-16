import {
  int,
  list,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";

/** Ids of recent and listed achievements, the ones the site shows. */
export function achievementIds(achievements: unknown): number[] {
  const record = rec(achievements);
  return uniqueIds(
    [...list(record.recent_events), ...list(record.achievements)].map(
      (entry) => rec(rec(entry).achievement).id,
    ),
  );
}

export function classIdOf(summary: unknown): number {
  return int(rec(rec(summary).character_class).id) ?? 0;
}

export function mediaIds(equipment: unknown): number[] {
  return uniqueIds(
    list(rec(equipment).equipped_items).map((item) => {
      const record = rec(item);
      return rec(record.media).id ?? rec(record.item).id;
    }),
  );
}

export function hasAvatar(media: unknown): boolean {
  return list(rec(media).assets)
    .map(rec)
    .some((asset) => asset.key === "avatar" && str(asset.value) !== undefined);
}

function uniqueIds(values: readonly unknown[]): number[] {
  return [
    ...new Set(
      values.flatMap((value) => {
        const id = positiveInt(value);
        return id === undefined ? [] : [id];
      }),
    ),
  ];
}
