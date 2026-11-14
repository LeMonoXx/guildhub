import type { ContentLocale } from "@guildhub/contracts";
import type { AppError } from "../../../platform/kernel/app-error.js";
import type { Result } from "../../../platform/kernel/result.js";
import type { CharacterFacts, LookBakeDocument } from "../domain/look.js";
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
}

export interface ModelAssetStore {
  currentBuild(): Promise<string | undefined>;
  hasLook(lookHash: string): Promise<boolean>;
  writeLookRequest(job: LookBakeDocument): Promise<void>;
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
