/** Bar colours of the in-game unit frame, keyed by Battle.net power type. */
export const powerColorVar = (powerType: string | undefined): string => {
  switch (powerType?.toLowerCase()) {
    case "rage":
      return "var(--power-rage)";
    case "energy":
      return "var(--power-energy)";
    case "focus":
      return "var(--power-focus)";
    default:
      return "var(--power-mana)";
  }
};

/** Reputation tiers from Hated (0) to Exalted (7). */
export const reputationColorVar = (tier: number): string =>
  `var(--standing-${String(Math.min(Math.max(tier, 0), 7))})`;
