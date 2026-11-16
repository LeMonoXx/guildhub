import type { TalentNode, TalentTree } from "@guildhub/contracts";
import {
  list,
  nonNegativeInt,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import { activeSpecializations } from "./map-character-skills.js";
import type {
  TalentNodeLayout,
  TalentTreeLayout,
} from "./battle-net-talent-tree-catalog.js";

interface Learned {
  readonly ranks: ReadonlyMap<number, number>;
  readonly spentBySpec: ReadonlyMap<number, number>;
}

/**
 * The class's trees with this character's ranks filled in. Learned talents
 * are matched by talent id; specs without points simply show empty trees.
 */
export function mapTalentTrees(
  layouts: readonly TalentTreeLayout[],
  rawSpecializations: unknown,
  iconUrl: (iconId: number) => string,
): TalentTree[] {
  const learned = learnedOf(rawSpecializations);
  const placed = layouts.map((layout) => ({
    ...layout,
    nodes: layout.nodes.filter((node) => node.row <= TREE_DEPTH),
  }));
  const columns = treeColumns(placed);
  return placed.map((layout) => {
    const nodes = layout.nodes.map((node) =>
      nodeOf(
        { ...node, column: columns.get(node.id) ?? node.column },
        learned,
        iconUrl,
      ),
    );
    return {
      specId: layout.specId,
      name: layout.name,
      ...optional(
        "iconUrl",
        layout.iconId === undefined ? undefined : iconUrl(layout.iconId),
      ),
      spentPoints:
        learned.spentBySpec.get(layout.specId) ??
        nodes.reduce((sum, node) => sum + node.rank, 0),
      rows: Math.max(1, ...nodes.map((node) => node.row)),
      columns: TREE_WIDTH,
      nodes,
    };
  });
}

const TREE_WIDTH = 4;
/**
 * Classic trees are seven tiers deep. The game data still lists a few
 * retired talents far below that (row 63); the talent frame never shows them.
 */
const TREE_DEPTH = 7;
/**
 * The game lays a class's three trees side by side on one grid, so the
 * second tree starts at column 7 and the third at column 14.
 */
const TREE_COLUMN_OFFSETS = [0, 6, 13] as const;

/**
 * Each node's column within its own four-wide tree. A few nodes carry stray
 * columns in the game data; they move to the nearest free cell of their row.
 */
export function treeColumns(
  layouts: readonly TalentTreeLayout[],
): Map<number, number> {
  const median = (layout: TalentTreeLayout) => {
    const sorted = layout.nodes
      .map((node) => node.column)
      .sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const ordered = [...layouts].sort((a, b) => median(a) - median(b));
  const columns = new Map<number, number>();
  ordered.forEach((layout, index) => {
    const offset =
      TREE_COLUMN_OFFSETS[index] ??
      Math.min(...layout.nodes.map((node) => node.column)) - 1;
    const taken = new Set<string>();
    const fits = (column: number) => column >= 1 && column <= TREE_WIDTH;
    const sorted = [...layout.nodes].sort(
      (a, b) =>
        Number(!fits(a.column - offset)) - Number(!fits(b.column - offset)),
    );
    for (const node of sorted) {
      const wanted = Math.min(TREE_WIDTH, Math.max(1, node.column - offset));
      const free = [0, -1, 1, -2, 2, -3, 3]
        .map((step) => wanted + step)
        .find(
          (column) =>
            fits(column) && !taken.has(`${String(node.row)}:${String(column)}`),
        );
      const column = free ?? wanted;
      taken.add(`${String(node.row)}:${String(column)}`);
      columns.set(node.id, column);
    }
  });
  return columns;
}

function nodeOf(
  node: TalentNodeLayout,
  learned: Learned,
  iconUrl: (iconId: number) => string,
): TalentNode {
  const maxRank = Math.max(1, node.rankDescriptions.length);
  const rank = Math.min(maxRank, learned.ranks.get(node.talentId) ?? 0);
  const current = node.rankDescriptions[Math.max(0, rank - 1)];
  const next =
    rank > 0 && rank < maxRank ? node.rankDescriptions[rank] : undefined;
  return {
    id: node.id,
    talentId: node.talentId,
    name: node.name,
    row: node.row,
    column: node.column,
    rank,
    maxRank,
    ...optional("spellId", node.spellId),
    ...optional(
      "iconUrl",
      node.iconId === undefined ? undefined : iconUrl(node.iconId),
    ),
    ...optional("castTime", node.castTime),
    ...optional("description", str(current)),
    ...optional("nextDescription", str(next)),
    requires: [...node.requires],
  };
}

/** Ranks by talent id and points by spec, from the active specialization group. */
function learnedOf(value: unknown): Learned {
  const ranks = new Map<number, number>();
  const spentBySpec = new Map<number, number>();
  for (const entry of activeSpecializations(value)) {
    const spec = rec(entry);
    const specId = nonNegativeInt(rec(spec.specialization).id);
    const spent = nonNegativeInt(spec.spent_points);
    if (specId !== undefined && spent !== undefined)
      spentBySpec.set(specId, spent);
    for (const talent of list(spec.talents)) {
      const record = rec(talent);
      const talentId = nonNegativeInt(rec(record.talent).id);
      const rank = nonNegativeInt(record.talent_rank);
      if (talentId !== undefined && rank !== undefined)
        ranks.set(talentId, rank);
    }
  }
  return { ranks, spentBySpec };
}
