export type CharacterSex = 0 | 1;

export interface LookCustomization {
  readonly optionId: number;
  readonly choiceId: number;
}

export interface EquipmentOverride {
  readonly itemId: number;
  readonly equipSlot: number;
}

/** Gear that changes how much room a character needs in a lineup. */
export type CarriedGear = "shield" | "two-hand";

export interface CharacterFacts {
  readonly raceId: number;
  readonly sex: CharacterSex;
  readonly classId: number;
  readonly customizations: readonly LookCustomization[];
  readonly itemIds: readonly number[];
  readonly equipmentOverrides: readonly EquipmentOverride[];
  readonly renderAssetUrl?: string;
  readonly avatarAssetUrl?: string;
  readonly carries?: readonly CarriedGear[];
}

export interface LookDescription extends CharacterFacts {
  readonly clientBuild: string;
}

export const MAIN_HAND_SLOT = 16;
export const OFF_HAND_SLOT = 17;

export const TROOP_ANIMATION_IDS = [0, 4, 67, 68, 115, 116, 119] as const;

export function canonicalLookKey(look: LookDescription): string {
  const custom = [...look.customizations]
    .sort((left, right) => left.optionId - right.optionId)
    .map((entry) => `${String(entry.optionId)}:${String(entry.choiceId)}`)
    .join(",");
  const items = [...look.itemIds]
    .sort((left, right) => left - right)
    .map((id) => String(id))
    .join(",");
  const overrides = [...look.equipmentOverrides]
    .sort((left, right) => left.itemId - right.itemId)
    .map((entry) => `${String(entry.itemId)}:${String(entry.equipSlot)}`)
    .join(",");
  return `${look.clientBuild}|${String(look.raceId)}|${String(look.sex)}|${String(look.classId)}|${custom}|${items}|${overrides}`;
}

export interface LookBakeDocument {
  readonly lookHash: string;
  readonly clientBuild: string;
  readonly race: number;
  readonly sex: CharacterSex;
  readonly classId: number;
  readonly customizations: readonly LookCustomization[];
  readonly items: readonly number[];
  readonly equipmentOverrides: readonly EquipmentOverride[];
  readonly animationIds: readonly number[];
}

export function toLookBakeDocument(
  lookHash: string,
  look: LookDescription,
): LookBakeDocument {
  return {
    lookHash,
    clientBuild: look.clientBuild,
    race: look.raceId,
    sex: look.sex,
    classId: look.classId,
    customizations: look.customizations,
    items: look.itemIds,
    equipmentOverrides: look.equipmentOverrides,
    animationIds: [...TROOP_ANIMATION_IDS],
  };
}
