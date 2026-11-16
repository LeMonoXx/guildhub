export type ModelStatus = "ready" | "pending" | "unavailable";

/** What the worker last wrote about a bake in progress. */
export interface BakeProgress {
  readonly stage: "opening" | "baking";
  readonly fraction: number;
  readonly updatedAt: Date;
}

export interface ModelBake {
  readonly state: "queued" | "opening" | "baking";
  readonly position?: number;
  readonly fraction?: number;
}

export interface CharacterModel {
  readonly status: ModelStatus;
  readonly lookHash: string;
  readonly clientBuild: string;
  readonly manifestUrl?: string;
  readonly renderUrl?: string;
  readonly bake?: ModelBake;
}

export function publicRenderUrl(slug: string): string {
  return `/api/characters/${slug}/render`;
}

export function publicAvatarUrl(slug: string): string {
  return `/api/characters/${slug}/avatar`;
}

export function publicIconUrl(iconId: number): string {
  return `/api/icons/${String(iconId)}`;
}

export function publicManifestUrl(lookHash: string): string {
  return `/assets/looks/${lookHash}/look.json`;
}
