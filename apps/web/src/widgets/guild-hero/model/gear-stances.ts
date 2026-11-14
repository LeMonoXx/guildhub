import type { FeaturedMember } from "@guildhub/contracts";

type CarriedGear = NonNullable<FeaturedMember["carries"]>[number];

/** Clips that hold gear out in front, over whoever stands ahead. */
const clipsRaising: Readonly<Record<CarriedGear, ReadonlySet<string>>> = {
  shield: new Set(["Ready1H", "StealthStand", "StealthWalk"]),
  "two-hand": new Set(),
};

/** `true` when `clip` keeps the member's gear at their side. */
export const keepsGearDown =
  (member: FeaturedMember) =>
  (clip: string): boolean =>
    !(member.carries ?? []).some((gear) => clipsRaising[gear].has(clip));
