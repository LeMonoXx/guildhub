import { FIXED_LOOK_MANIFEST } from "@guildhub/contracts";
import type { RosterMember } from "../domain/roster-member.js";

export function toPublicRosterMember(member: RosterMember) {
  return {
    characterId: member.characterId,
    name: member.name,
    surname: member.surname,
    level: member.level,
    rankId: member.rankId,
    classId: member.classId,
    raceId: member.raceId,
    slug: member.slug,
  };
}

export function presentMember(member: RosterMember) {
  return {
    ...toPublicRosterMember(member),
    pose: "Stand",
    accent: `class-${member.classId}`,
    lookManifest: FIXED_LOOK_MANIFEST,
  };
}

/** A featured member, with the model state the character module may add. */
export type FeaturedPresentation = ReturnType<typeof presentMember> & {
  readonly model?: { readonly status: string };
};

/** A bake in progress changes the lineup without changing the roster. */
export const lineupIsSettled = (
  members: readonly FeaturedPresentation[],
): boolean => members.every((member) => member.model?.status !== "pending");
