import type { RosterMember } from "../../guild/index.js";
import type { CarriedGear } from "../domain/look.js";
import type { CharacterModel } from "../domain/model.js";

export interface CharacterView {
  readonly member: RosterMember;
  /** False when Battle.net does not publish this character's profile. */
  readonly published: boolean;
  readonly model: CharacterModel;
  readonly lookManifest: string;
  readonly renderUrl?: string;
  readonly pose: string;
  readonly accent: string;
  readonly carries: readonly CarriedGear[];
}
