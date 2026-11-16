import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import { defaultContentLocale, type ContentLocale } from "@guildhub/contracts";
import {
  iconIdOf,
  list,
  optional,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { BattleNetResource } from "../../../platform/blizzard/request.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequestPatiently } from "./battle-net-request.js";

const REQUEST_CONCURRENCY = 6;

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

interface TreeEntry {
  readonly treeId: number;
  readonly specId: number;
}

type Settled<T> =
  { readonly settled: true; readonly value: T } | { readonly settled: false };

/**
 * The three talent trees of each class, in the game's order, with spell
 * icons. Trees and icons never change for a game build, so each is fetched
 * once per process; temporary failures are retried on the next lookup.
 */
export class BattleNetTalentTreeCatalog {
  private entries: readonly TreeEntry[] | undefined;
  private readonly classOfTree = new Map<number, number>();
  private readonly trees = new Map<number, TalentTreeLayout | undefined>();
  private readonly spellIcons = new Map<number, number | undefined>();
  private readonly specIcons = new Map<number, number | undefined>();

  constructor(
    private readonly client: BlizzardApiClient,
    private readonly locale: ContentLocale = defaultContentLocale,
  ) {}

  async forClass(classId: number): Promise<readonly TalentTreeLayout[]> {
    const entries = await this.index();
    const treeId = await this.treeIdOfClass(classId, entries);
    if (treeId === undefined) return [];
    const specs = entries.filter((entry) => entry.treeId === treeId);
    await mapLimited(specs, REQUEST_CONCURRENCY, (entry) =>
      this.loadTree(entry),
    );
    const layouts = specs.flatMap((entry) => {
      const tree = this.trees.get(entry.specId);
      return tree === undefined ? [] : [tree];
    });
    if (layouts.length < specs.length) return [];
    await this.loadIcons(layouts);
    return layouts.map((layout) => this.withIcons(layout));
  }

  private async index(): Promise<readonly TreeEntry[]> {
    if (this.entries) return this.entries;
    const index = await this.fetch(wowForever.talentTreeIndex());
    const entries = index.settled ? treeEntriesOf(index.value) : [];
    if (entries.length > 0) this.entries = entries;
    return entries;
  }

  /** A tree's class shows only in its spec trees, so peek at one spec per tree. */
  private async treeIdOfClass(
    classId: number,
    entries: readonly TreeEntry[],
  ): Promise<number | undefined> {
    const treeIds = [...new Set(entries.map((entry) => entry.treeId))];
    const unknown = treeIds.filter((treeId) => !this.classOfTree.has(treeId));
    await mapLimited(unknown, REQUEST_CONCURRENCY, async (treeId) => {
      const first = entries.find((entry) => entry.treeId === treeId);
      if (first) await this.loadTree(first);
    });
    return treeIds.find((treeId) => this.classOfTree.get(treeId) === classId);
  }

  private async loadTree(entry: TreeEntry): Promise<void> {
    if (this.trees.has(entry.specId)) return;
    const body = await this.fetch(
      wowForever.talentTree(entry.treeId, entry.specId),
    );
    if (!body.settled) return;
    const classId = positiveInt(rec(rec(body.value).playable_class).id);
    if (classId !== undefined) this.classOfTree.set(entry.treeId, classId);
    this.trees.set(entry.specId, treeLayoutOf(entry.specId, body.value));
  }

  private async loadIcons(layouts: readonly TalentTreeLayout[]): Promise<void> {
    const spellIds = layouts.flatMap((layout) =>
      layout.nodes.flatMap((node) =>
        node.spellId === undefined ? [] : [node.spellId],
      ),
    );
    await Promise.all([
      this.loadMedia(this.spellIcons, spellIds, (id) =>
        wowForever.spellMedia(id),
      ),
      this.loadMedia(
        this.specIcons,
        layouts.map((layout) => layout.specId),
        (id) => wowForever.playableSpecializationMedia(id),
      ),
    ]);
  }

  private async loadMedia(
    cache: Map<number, number | undefined>,
    ids: readonly number[],
    endpoint: (id: number) => BattleNetResource,
  ): Promise<void> {
    const missing = [...new Set(ids)].filter((id) => !cache.has(id));
    await mapLimited(missing, REQUEST_CONCURRENCY, async (id) => {
      const media = await this.fetch(endpoint(id));
      if (media.settled) cache.set(id, iconIdOf(media.value));
    });
  }

  private withIcons(layout: TalentTreeLayout): TalentTreeLayout {
    return {
      ...layout,
      ...optional("iconId", this.specIcons.get(layout.specId)),
      nodes: layout.nodes.map((node) => ({
        ...node,
        ...optional(
          "iconId",
          node.spellId === undefined
            ? undefined
            : this.spellIcons.get(node.spellId),
        ),
      })),
    };
  }

  /** Settled means the answer will not change: a body, or a definite "not found". */
  private async fetch(resource: BattleNetResource): Promise<Settled<unknown>> {
    const result = await sendCharacterRequestPatiently(this.client, resource, {
      locale: this.locale,
    });
    if (result.ok) return { settled: true, value: result.value };
    return result.error.code === "character.not_found"
      ? { settled: true, value: undefined }
      : { settled: false };
  }
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
