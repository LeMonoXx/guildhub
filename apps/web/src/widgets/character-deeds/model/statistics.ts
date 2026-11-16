import type { StatisticGroup } from "@guildhub/contracts";

const SPOTLIGHT_SIZE = 4;

/** Non-zero entries, largest first, so every category is on the page at once. */
export function toldGroups(
  groups: readonly StatisticGroup[],
): StatisticGroup[] {
  return groups
    .map((group) => ({
      ...group,
      entries: [...group.entries]
        .filter((entry) => entry.quantity !== 0)
        .sort(
          (left, right) => Math.abs(right.quantity) - Math.abs(left.quantity),
        ),
    }))
    .filter((group) => group.entries.length > 0);
}

/** The groups whose leading number is largest; expects `toldGroups` output. */
export function spotlightGroups(
  groups: readonly StatisticGroup[],
): StatisticGroup[] {
  return [...groups]
    .sort((left, right) => leadSize(right) - leadSize(left))
    .slice(0, SPOTLIGHT_SIZE);
}

const leadSize = (group: StatisticGroup): number =>
  Math.abs(group.entries[0]?.quantity ?? 0);
