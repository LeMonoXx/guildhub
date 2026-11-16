import { describe, expect, it } from "vitest";
import { treeEntriesOf, treeLayoutOf } from "./talent-tree-layout.js";
import { mapTalentTrees, treeColumns } from "./map-talent-trees.js";

const rank = (talentId: number, spellId: number, description: string) => ({
  tooltip: {
    talent: { name: "Suppression", id: talentId },
    spell_tooltip: {
      spell: { id: spellId, name: "Suppression" },
      description,
      cast_time: "Passive",
    },
  },
});

const afflictionBody = {
  playable_class: { id: 9 },
  playable_specialization: { id: 355, name: "Affliction" },
  spec_talent_nodes: [
    {
      id: 105925,
      display_row: 1,
      display_col: 2,
      ranks: [
        rank(135456, 18174, "Hit +1%"),
        rank(135456, 18174, "Hit +2%"),
        rank(135456, 18174, "Hit +3%"),
      ],
    },
    {
      id: 105913,
      display_row: 4,
      display_col: 3,
      locked_by: [105916],
      ranks: [rank(135444, 18223, "Curse of Exhaustion")],
    },
    { id: 1, ranks: [] },
  ],
};

describe("talent tree layouts", () => {
  it("reads tree and spec ids from the index links", () => {
    expect(
      treeEntriesOf({
        spec_talent_trees: [
          {
            key: {
              href: "https://x/data/wow/talent-tree/1116/playable-specialization/355?namespace=n",
            },
          },
          { key: { href: "broken" } },
        ],
      }),
    ).toEqual([{ treeId: 1116, specId: 355 }]);
  });

  it("keeps grid position, every rank text and prerequisites, skipping broken nodes", () => {
    const layout = treeLayoutOf(355, afflictionBody);
    expect(layout?.name).toBe("Affliction");
    expect(layout?.nodes).toHaveLength(2);
    expect(layout?.nodes[0]).toMatchObject({
      talentId: 135456,
      row: 1,
      column: 2,
      spellId: 18174,
      rankDescriptions: ["Hit +1%", "Hit +2%", "Hit +3%"],
      requires: [],
    });
    expect(layout?.nodes[1]?.requires).toEqual([105916]);
  });
});

describe("mapTalentTrees", () => {
  it("fills in learned ranks with the current and next rank texts", () => {
    const layout = treeLayoutOf(355, afflictionBody);
    if (!layout) throw new Error("layout");
    const [tree] = mapTalentTrees(
      [
        {
          ...layout,
          iconId: 7,
          nodes: layout.nodes.map((node) => ({ ...node, iconId: 99 })),
        },
      ],
      {
        specialization_groups: [
          {
            is_active: true,
            specializations: [
              {
                specialization: { id: 355 },
                spent_points: 2,
                talents: [{ talent: { id: 135456 }, talent_rank: 2 }],
              },
            ],
          },
        ],
      },
      (id) => `/icons/${String(id)}`,
    );
    expect(tree).toMatchObject({
      specId: 355,
      spentPoints: 2,
      rows: 4,
      columns: 4,
      iconUrl: "/icons/7",
    });
    expect(tree?.nodes[0]).toMatchObject({
      rank: 2,
      maxRank: 3,
      description: "Hit +2%",
      nextDescription: "Hit +3%",
      iconUrl: "/icons/99",
    });
    expect(tree?.nodes[1]).toMatchObject({
      rank: 0,
      maxRank: 1,
      description: "Curse of Exhaustion",
    });
    expect(tree?.nodes[1]?.nextDescription).toBeUndefined();
  });

  it("leaves out retired talents listed below the seventh tier", () => {
    const placed = {
      id: 1,
      talentId: 1,
      name: "Hawk Eye",
      row: 7,
      column: 2,
      rankDescriptions: [""],
      requires: [],
    };
    const retired = { ...placed, id: 2, talentId: 2, row: 63, column: 4 };
    const [tree] = mapTalentTrees(
      [{ specId: 363, name: "Marksmanship", nodes: [placed, retired] }],
      {},
      (id) => `/icons/${String(id)}`,
    );
    expect(tree?.rows).toBe(7);
    expect(tree?.nodes.map((node) => node.id)).toEqual([1]);
  });
});

describe("treeColumns", () => {
  const node = (id: number, row: number, column: number) => ({
    id,
    talentId: id,
    name: String(id),
    row,
    column,
    rankDescriptions: [""],
    requires: [],
  });
  const tree = (specId: number, nodes: ReturnType<typeof node>[]) => ({
    specId,
    name: String(specId),
    nodes,
  });

  it("brings the class-wide grid back to four columns per tree", () => {
    const columns = treeColumns([
      tree(3, [node(31, 1, 14), node(32, 1, 17)]),
      tree(1, [node(11, 1, 1), node(12, 1, 4)]),
      tree(2, [node(21, 1, 7), node(22, 2, 10)]),
    ]);
    expect(Object.fromEntries(columns)).toEqual({
      11: 1,
      12: 4,
      21: 1,
      22: 4,
      31: 1,
      32: 4,
    });
  });

  it("moves stray columns to the nearest free cell of their row", () => {
    const columns = treeColumns([
      tree(1, [node(11, 1, 1)]),
      tree(2, [node(21, 1, 7), node(22, 3, 10), node(23, 3, 14)]),
      tree(3, [node(31, 1, 14), node(32, 2, 170)]),
    ]);
    expect(columns.get(23)).toBe(3);
    expect(columns.get(22)).toBe(4);
    expect(columns.get(32)).toBe(4);
  });
});
