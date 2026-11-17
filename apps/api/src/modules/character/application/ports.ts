import type { ContentLocale, EquippedItem } from "@guildhub/contracts";
import type { AppError } from "../../../platform/kernel/app-error.js";
import type { Result } from "../../../platform/kernel/result.js";
import type { CharacterFacts, LookBakeDocument } from "../domain/look.js";
import type { BakeProgress } from "../domain/model.js";
import type {
  CharacterProfileData,
  CharacterProfileSnapshot,
} from "../domain/profile.js";
import type { CharacterSnapshot } from "../domain/snapshot.js";

export type CharacterSourceError =
  AppError<"character.not_found"> | AppError<"upstream.unavailable">;

export interface CharacterRef {
  readonly characterId: string;
  readonly name: string;
  readonly surname: string;
  readonly slug: string;
  readonly raceId: string;
  readonly classId: string;
}

export interface CharacterSource {
  fetchFacts(
    character: CharacterRef,
  ): Promise<Result<CharacterFacts, CharacterSourceError>>;
}

export type ItemLookupError =
  AppError<"item.not_found"> | AppError<"upstream.unavailable">;

/** Static game data: what an item is, as its tooltip shows it. */
export interface ItemCatalog {
  item(
    itemId: number,
    locale: ContentLocale,
  ): Promise<Result<EquippedItem, ItemLookupError>>;
}

export interface CharacterProfileSource {
  fetchProfile(
    character: CharacterRef,
    locale: ContentLocale,
  ): Promise<Result<CharacterProfileData, CharacterSourceError>>;
}

/** Profiles hold game texts, so each language is cached on its own. */
export interface CharacterProfileCache {
  latestMany(
    characterIds: readonly string[],
    locale: ContentLocale,
  ): Promise<readonly CharacterProfileSnapshot[]>;
  save(
    snapshot: CharacterProfileSnapshot,
    locale: ContentLocale,
  ): Promise<void>;
}

export interface CharacterCache {
  latest(characterId: string): Promise<CharacterSnapshot | undefined>;
  latestMany(
    characterIds: readonly string[],
  ): Promise<readonly CharacterSnapshot[]>;
  save(snapshot: CharacterSnapshot): Promise<void>;
}

export interface ConvertFileJob {
  readonly build: string;
  readonly outputVersion: number;
  readonly fileId: number;
  readonly kind: "model" | "texture" | "animation";
  readonly modelFileId?: number;
  readonly animationId?: number;
}

export interface ModelBuildQueue {
  enqueueLook(job: LookBakeDocument): Promise<void>;
  enqueueConvert(job: ConvertFileJob): Promise<void>;
  /** Hashes of looks waiting to be baked, next first. */
  queuedLooks(): Promise<readonly string[]>;
}

export interface ModelAssetStore {
  currentBuild(): Promise<string | undefined>;
  hasLook(lookHash: string): Promise<boolean>;
  writeLookRequest(job: LookBakeDocument): Promise<void>;
  /** Undefined when no bake of this look is running. */
  bakeProgress(lookHash: string): Promise<BakeProgress | undefined>;
}

export type BakeUpdate = Omit<BakeProgress, "updatedAt">;

/** Turns looks and game files into the model assets the viewer loads. */
export interface ModelBaker {
  bakeLook(
    look: LookBakeDocument,
    onUpdate: (update: BakeUpdate) => void,
  ): Promise<void>;
  bakeFile(job: ConvertFileJob): Promise<void>;
  bakeFixedLook(): Promise<void>;
  /** The game build Blizzard serves right now. */
  currentBuild(): Promise<string>;
  /** `baked` is false when the current game build already has this body. */
  prebakeBody(race: number, sex: number): Promise<{ readonly baked: boolean }>;
}

/** What the last prebakes established; kept across restarts. */
export interface PrebakeRecord {
  /** The playable races, as Battle.net listed them for this build. */
  readonly races?: { readonly build: string; readonly ids: readonly number[] };
  /** The last build whose every body is baked. */
  readonly completeBuild?: string;
}

export interface PrebakeLedger {
  read(): Promise<PrebakeRecord>;
  write(record: PrebakeRecord): Promise<void>;
}

/** Publishes how far a running bake is, for the API to read. */
export interface BakeProgressSink {
  track(lookHash: string): {
    update(update: BakeUpdate): void;
    finish(): Promise<void>;
  };
}

export interface PlayableRaceSource {
  playableRaceIds(): Promise<
    Result<readonly number[], AppError<"upstream.unavailable">>
  >;
}

export interface CharacterMediaGateway {
  fetchRender(
    url: string,
  ): Promise<
    { readonly body: Uint8Array; readonly contentType: string } | undefined
  >;
  fetchIcon(
    iconId: number,
  ): Promise<
    { readonly body: Uint8Array; readonly contentType: string } | undefined
  >;
}
