export const skillShare = (value: number, scale: number): number =>
  Math.min(1, Math.max(0, value / scale));

/** Bar and scale place every mark through this, so they always line up. */
export const skillMarkAt = (value: number, scale: number): string =>
  `${String(skillShare(value, scale) * 100)}%`;
