import type { GuildDossier } from "@guildhub/contracts";

export type DossierOrder = "level" | "itemLevel" | "recent";

export const dossierOrders: readonly DossierOrder[] = [
  "level",
  "itemLevel",
  "recent",
];

const NEVER_SEEN = "1970-01-01";

const comparators: Readonly<
  Record<DossierOrder, (a: GuildDossier, b: GuildDossier) => number>
> = {
  level: (a, b) =>
    b.level - a.level || b.achievementPoints - a.achievementPoints,
  itemLevel: (a, b) => (b.averageItemLevel ?? 0) - (a.averageItemLevel ?? 0),
  recent: (a, b) =>
    Date.parse(b.lastLoginAt ?? NEVER_SEEN) -
    Date.parse(a.lastLoginAt ?? NEVER_SEEN),
};

export const sortDossiers = (
  dossiers: readonly GuildDossier[],
  order: DossierOrder,
): GuildDossier[] => [...dossiers].sort(comparators[order]);
