import type { CharacterFacts } from "./look.js";

/** `missing` means Battle.net does not publish this character's profile. */
export type CharacterSnapshotStatus = "found" | "missing";

export interface CharacterSnapshot {
  readonly characterId: string;
  readonly slug: string;
  readonly name: string;
  readonly surname: string;
  readonly status: CharacterSnapshotStatus;
  readonly facts: CharacterFacts;
  readonly fetchedAt: Date;
}
