import {
  list,
  optional,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";

/** One talent's place and texts in its tree; static game data. */
export interface TalentNodeLayout {
  readonly id: number;
  readonly talentId: number;
  readonly name: string;
  readonly row: number;
  readonly column: number;
  readonly spellId?: number;
  readonly iconId?: number;
  readonly castTime?: string;
  /** Index 0 is rank 1. */
  readonly rankDescriptions: readonly string[];
  readonly requires: readonly number[];
}

export interface TalentTreeLayout {
  readonly specId: number;
  readonly name: string;
  readonly iconId?: number;
  readonly nodes: readonly TalentNodeLayout[];
}

export interface TreeEntry {
  readonly treeId: number;
  readonly specId: number;
}

export function treeEntriesOf(index: unknown): TreeEntry[] {
  return list(rec(index).spec_talent_trees).flatMap((entry) => {
    const href = str(rec(rec(entry).key).href) ?? "";
    const match = /talent-tree\/(\d+)\/playable-specialization\/(\d+)/.exec(
      href,
    );
    return match
      ? [{ treeId: Number(match[1]), specId: Number(match[2]) }]
      : [];
  });
}

export function treeLayoutOf(
  specId: number,
  body: unknown,
): TalentTreeLayout | undefined {
  const tree = rec(body);
  const name = str(rec(tree.playable_specialization).name) ?? str(tree.name);
  if (name === undefined) return undefined;
  return {
    specId,
    name,
    nodes: list(tree.spec_talent_nodes).flatMap((node) => {
      const layout = nodeLayoutOf(node);
      return layout === undefined ? [] : [layout];
    }),
  };
}

function nodeLayoutOf(value: unknown): TalentNodeLayout | undefined {
  const node = rec(value);
  const ranks = list(node.ranks).map((rank) => rec(rec(rank).tooltip));
  const first = ranks[0];
  const talent = rec(first?.talent);
  const spell = rec(first?.spell_tooltip);
  const id = positiveInt(node.id);
  const talentId = positiveInt(talent.id);
  const name = str(talent.name) ?? str(rec(spell.spell).name);
  const row = positiveInt(node.display_row);
  const column = positiveInt(node.display_col);
  if (
    id === undefined ||
    talentId === undefined ||
    row === undefined ||
    column === undefined ||
    name === undefined
  )
    return undefined;
  return {
    id,
    talentId,
    name,
    row,
    column,
    ...optional("spellId", positiveInt(rec(spell.spell).id)),
    ...optional("castTime", str(spell.cast_time)),
    rankDescriptions: ranks.map(
      (rank) => str(rec(rank.spell_tooltip).description) ?? "",
    ),
    requires: list(node.locked_by).flatMap((required) => {
      const requiredId = positiveInt(required);
      return requiredId === undefined ? [] : [requiredId];
    }),
  };
}
