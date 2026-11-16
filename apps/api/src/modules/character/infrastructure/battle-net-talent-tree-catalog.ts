import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import { defaultContentLocale, type ContentLocale } from "@guildhub/contracts";
import {
  iconIdOf,
  optional,
  positiveInt,
  rec,
} from "../../../platform/blizzard/document.js";
import type { BattleNetResource } from "../../../platform/blizzard/request.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequestPatiently } from "./battle-net-request.js";
import {
  treeEntriesOf,
  treeLayoutOf,
  type TalentTreeLayout,
  type TreeEntry,
} from "./talent-tree-layout.js";

const REQUEST_CONCURRENCY = 6;

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
