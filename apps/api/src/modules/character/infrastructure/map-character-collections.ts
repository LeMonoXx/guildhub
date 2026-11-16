import {
  int,
  list,
  name,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";
import { quality } from "./map-equipped-item.js";

export function mapCollections(raw: {
  readonly mounts?: unknown;
  readonly pets?: unknown;
  readonly toys?: unknown;
  readonly heirlooms?: unknown;
}): CharacterProfileData["collections"] {
  return {
    mounts: names(list(rec(raw.mounts).mounts).map((m) => rec(m).mount)),
    pets: list(rec(raw.pets).pets).flatMap((entry) => {
      const record = rec(entry);
      const label = name(record.species);
      if (!label) return [];
      return [
        {
          name: str(record.name) ?? label,
          level: Math.max(0, int(record.level) ?? 0),
          ...optional("quality", quality(record.quality)),
        },
      ];
    }),
    toys: names(list(rec(raw.toys).toys).map((t) => rec(t).toy)),
    heirlooms: names(
      list(rec(raw.heirlooms).heirlooms).map((h) => rec(h).heirloom),
    ),
  };
}

export function mapHunterPets(
  value: unknown,
): CharacterProfileData["hunterPets"] {
  return list(rec(value).hunter_pets).flatMap((entry) => {
    const record = rec(entry);
    const label = str(record.name);
    if (!label) return [];
    return [
      {
        name: label,
        level: Math.max(0, int(record.level) ?? 0),
        ...optional("creature", name(record.creature)),
        active: record.is_active === true,
      },
    ];
  });
}

function names(values: readonly unknown[]): string[] {
  return values.flatMap((value) => {
    const label = name(value);
    return label ? [label] : [];
  });
}
