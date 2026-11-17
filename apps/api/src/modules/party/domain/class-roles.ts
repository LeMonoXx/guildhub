import type { PartyRole } from "@guildhub/contracts";

/** What each class can fill in a five-player group, its most usual role first. */
const CLASS_ROLES: Readonly<Record<string, readonly PartyRole[]>> = {
  "1": ["tank", "damage"],
  "2": ["healer", "tank", "damage"],
  "5": ["healer", "damage"],
  "7": ["healer", "damage"],
  "11": ["healer", "tank", "damage"],
};

const DAMAGE_ONLY: readonly PartyRole[] = ["damage"];

export const rolesOf = (classId: string): readonly PartyRole[] =>
  CLASS_ROLES[classId] ?? DAMAGE_ONLY;
