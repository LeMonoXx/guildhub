export type ModelStatus = "ready" | "pending" | "unavailable";

export interface CharacterModel {
  readonly status: ModelStatus;
  readonly lookHash: string;
  readonly clientBuild: string;
  readonly manifestUrl?: string;
  readonly renderUrl?: string;
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
