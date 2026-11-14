import type { TalentNode, TalentTree } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";

import {
  leadingTree,
  pointSplit,
  talentArrows,
  talentState,
} from "./talent-grid";

const node = (
  overrides: Partial<TalentNode> & Pick<TalentNode, "id" | "row" | "column">,
): TalentNode => ({
  talentId: overrides.id + 1000,
  name: `Talent ${String(overrides.id)}`,
  rank: 0,
  maxRank: 5,
  requires: [],
  ...overrides,
});

const tree = (spentPoints: number, nodes: TalentNode[]): TalentTree => ({
  specId: 355,
  name: "Affliction",
  spentPoints,
  rows: 7,
  columns: 4,
  nodes,
});

describe("talentState", () => {
  test("follows the talent frame: maxed, partly learned, open, locked", () => {
    const maxed = node({ id: 1, row: 1, column: 1, rank: 5 });
    const partial = node({ id: 2, row: 1, column: 2, rank: 2 });
    const open = node({ id: 3, row: 2, column: 1 });
    const tooDeep = node({ id: 4, row: 3, column: 1 });
    const blocked = node({ id: 5, row: 2, column: 2, requires: [2] });
    const board = tree(7, [maxed, partial, open, tooDeep, blocked]);
    expect(talentState(maxed, board)).toBe("maxed");
    expect(talentState(partial, board)).toBe("partial");
    expect(talentState(open, board)).toBe("available");
    expect(talentState(tooDeep, board)).toBe("locked");
    expect(talentState(blocked, board)).toBe("locked");
  });
});

describe("talentArrows", () => {
  test("draws prerequisites down a column and lights them once maxed", () => {
    const required = node({ id: 1, row: 3, column: 3, rank: 1, maxRank: 1 });
    const unlocked = node({ id: 2, row: 5, column: 3, requires: [1] });
    const [arrow] = talentArrows(tree(20, [required, unlocked]));
    expect(arrow?.met).toBe(true);
    expect(arrow?.path).toBe("M 2.5 2.5 L 2.5 2.5 L 2.5 4.14");
  });

  test("ends beside the icon for a prerequisite in the same row", () => {
    const required = node({ id: 1, row: 2, column: 1 });
    const unlocked = node({ id: 2, row: 2, column: 2, requires: [1] });
    const [arrow] = talentArrows(tree(5, [required, unlocked]));
    expect(arrow?.met).toBe(false);
    expect(arrow?.path).toBe("M 0.5 1.5 L 1.14 1.5 L 1.14 1.5");
  });
});

describe("point summaries", () => {
  test("lists points in tree order and finds the deepest tree", () => {
    const trees = [
      tree(16, []),
      { ...tree(0, []), specId: 1 },
      { ...tree(35, []), specId: 2 },
    ];
    expect(pointSplit(trees)).toBe("16 / 0 / 35");
    expect(leadingTree(trees)?.specId).toBe(2);
  });
});
