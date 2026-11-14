import type { TalentNode, TalentTree } from "@guildhub/contracts";

/** Every row of a classic tree opens after this many points in that tree. */
export const pointsPerRow = 5;

export type TalentState = "maxed" | "partial" | "available" | "locked";

export const rowRequirement = (row: number): number => (row - 1) * pointsPerRow;

const nodesById = (tree: TalentTree) =>
  new Map(tree.nodes.map((node) => [node.id, node]));

export const prerequisitesOf = (
  node: TalentNode,
  tree: TalentTree,
): TalentNode[] => {
  const byId = nodesById(tree);
  return node.requires.flatMap((id) => {
    const required = byId.get(id);
    return required ? [required] : [];
  });
};

const prerequisitesMet = (node: TalentNode, tree: TalentTree) =>
  prerequisitesOf(node, tree).every(
    (required) => required.rank >= required.maxRank,
  );

/** First matching rule wins, as in the game's talent frame. */
const stateRules: readonly (readonly [
  TalentState,
  (node: TalentNode, tree: TalentTree) => boolean,
])[] = [
  ["maxed", (node) => node.rank >= node.maxRank],
  ["partial", (node) => node.rank > 0],
  [
    "available",
    (node, tree) =>
      tree.spentPoints >= rowRequirement(node.row) &&
      prerequisitesMet(node, tree),
  ],
];

export const talentState = (node: TalentNode, tree: TalentTree): TalentState =>
  stateRules.find(([, applies]) => applies(node, tree))?.[0] ?? "locked";

/** An arrow from a prerequisite to the talent it unlocks, in grid cells. */
export interface TalentArrow {
  readonly id: string;
  readonly path: string;
  readonly met: boolean;
}

/** How far from a cell's center its icon edge is, in cells. */
const iconReach = 0.36;

const fixed = (value: number) => String(Math.round(value * 1000) / 1000);

const center = (node: TalentNode) => ({
  x: node.column - 0.5,
  y: node.row - 0.5,
});

/** Straight down or across, or across then down for an offset pair. */
export const talentArrows = (tree: TalentTree): TalentArrow[] =>
  tree.nodes.flatMap((node) =>
    prerequisitesOf(node, tree).map((required) => {
      const from = center(required);
      const to = center(node);
      const sameRow = from.y === to.y;
      const end = sameRow
        ? { x: to.x - Math.sign(to.x - from.x) * iconReach, y: to.y }
        : { x: to.x, y: to.y - iconReach };
      return {
        id: `${String(required.id)}-${String(node.id)}`,
        path: `M ${fixed(from.x)} ${fixed(from.y)} L ${fixed(end.x)} ${fixed(from.y)} L ${fixed(end.x)} ${fixed(end.y)}`,
        met: required.rank >= required.maxRank,
      };
    }),
  );

/** "16 / 0 / 5", in tree order. */
export const pointSplit = (trees: readonly TalentTree[]): string =>
  trees.map((tree) => String(tree.spentPoints)).join(" / ");

export const leadingTree = (
  trees: readonly TalentTree[],
): TalentTree | undefined =>
  trees.reduce<TalentTree | undefined>(
    (best, tree) =>
      best === undefined || tree.spentPoints > best.spentPoints ? tree : best,
    undefined,
  );
