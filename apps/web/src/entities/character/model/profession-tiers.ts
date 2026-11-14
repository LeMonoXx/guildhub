export type ProfessionTier = "apprentice" | "journeyman" | "expert" | "artisan";

/** Classic training ranks and the skill cap each one unlocks. */
export const professionTiers: readonly {
  readonly tier: ProfessionTier;
  readonly cap: number;
}[] = [
  { tier: "apprentice", cap: 75 },
  { tier: "journeyman", cap: 150 },
  { tier: "expert", cap: 225 },
  { tier: "artisan", cap: 300 },
];

export const professionScale = 300;

/** The highest rank whose cap the character has unlocked, if any. */
export const tierOf = (maxSkill: number): ProfessionTier | undefined =>
  professionTiers.filter((entry) => entry.cap <= maxSkill).at(-1)?.tier;

interface Ranked {
  readonly name: string;
  readonly skill: number;
  readonly maxSkill: number;
}

export const bySkill = (left: Ranked, right: Ranked): number =>
  right.skill - left.skill ||
  right.maxSkill - left.maxSkill ||
  left.name.localeCompare(right.name);
