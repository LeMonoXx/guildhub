/** A rebuild that loses more than this share of recipes keeps the old catalog. */
export const MIN_COMPLETENESS = 0.8;

export const isCompleteEnough = (found: number, listed: number): boolean =>
  listed > 0 && found >= listed * MIN_COMPLETENESS;
