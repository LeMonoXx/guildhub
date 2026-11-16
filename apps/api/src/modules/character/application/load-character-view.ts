import type { Clock } from "../../../platform/kernel/clock.js";
import {
  isFresh,
  presentMember,
  type RosterMember,
} from "../../guild/index.js";
import type { CharacterFacts, LookDescription } from "../domain/look.js";
import type { CharacterSnapshot } from "../domain/snapshot.js";
import type { CharacterView } from "./character-view.js";
import type {
  CharacterCache,
  CharacterRef,
  CharacterSource,
  ModelAssetStore,
  ModelBuildQueue,
} from "./ports.js";
import { resolveCharacterModel } from "./resolve-model.js";

export interface CharacterViewDeps {
  readonly source: CharacterSource;
  readonly cache: CharacterCache;
  readonly assets: ModelAssetStore;
  readonly queue: ModelBuildQueue;
  readonly clock: Clock;
  readonly maxAgeMs: number;
  readonly fallbackBuild: string;
}

/** A member's look and model state, from a fresh snapshot or Battle.net. */
export async function loadCharacterView(
  deps: CharacterViewDeps,
  member: RosterMember,
  options: { enqueue: boolean },
): Promise<CharacterView> {
  const presented = presentMember(member);
  const clientBuild = (await deps.assets.currentBuild()) ?? deps.fallbackBuild;
  const snapshot = await loadSnapshot(deps, member);
  const look: LookDescription = {
    ...snapshot.facts,
    clientBuild,
  };
  const resolved = await resolveCharacterModel({
    slug: member.slug,
    look,
    assets: deps.assets,
    queue: deps.queue,
    enqueue: options.enqueue,
    hasRender: snapshot.facts.renderAssetUrl !== undefined,
    published: snapshot.status === "found",
  });
  return {
    member,
    published: snapshot.status === "found",
    model: resolved.model,
    lookManifest: resolved.lookManifest,
    renderUrl: resolved.model.renderUrl,
    pose: presented.pose,
    accent: presented.accent,
    carries: snapshot.facts.carries ?? [],
  };
}

async function loadSnapshot(
  deps: CharacterViewDeps,
  member: RosterMember,
): Promise<CharacterSnapshot> {
  const cached = await deps.cache.latest(member.characterId);
  const now = deps.clock.now();
  if (cached !== undefined && isFresh(cached.fetchedAt, now, deps.maxAgeMs)) {
    return cached;
  }
  const fetched = await deps.source.fetchFacts(toRef(member));
  const identity = {
    characterId: member.characterId,
    slug: member.slug,
    name: member.name,
    surname: member.surname,
    fetchedAt: now,
  };
  if (fetched.ok) {
    const snapshot: CharacterSnapshot = {
      ...identity,
      status: "found",
      facts: fetched.value,
    };
    await deps.cache.save(snapshot);
    return snapshot;
  }
  if (fetched.error.code === "character.not_found") {
    const missing: CharacterSnapshot = {
      ...identity,
      status: "missing",
      facts: factsFromRoster(member),
    };
    await deps.cache.save(missing);
    return missing;
  }
  if (cached !== undefined) return cached;
  return { ...identity, status: "missing", facts: factsFromRoster(member) };
}

export function toRef(member: RosterMember): CharacterRef {
  return {
    characterId: member.characterId,
    name: member.name,
    surname: member.surname,
    slug: member.slug,
    raceId: member.raceId,
    classId: member.classId,
  };
}

export function factsFromRoster(member: RosterMember): CharacterFacts {
  return {
    raceId: Number(member.raceId),
    sex: 0,
    classId: Number(member.classId),
    customizations: [],
    itemIds: [],
    equipmentOverrides: [],
  };
}
