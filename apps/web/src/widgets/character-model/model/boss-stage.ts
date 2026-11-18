import { resolveAsset } from "../lib/look-assets";
import { buildStandaloneModels, type StandaloneModel } from "./build-held-item";
import {
  loadCharacterModel,
  mountModelStage,
  type ModelStageState,
} from "./model-stage";

export type BossState = ModelStageState;

/** A creature drawn from its own model and the skins its display puts on it. */
interface CreatureBossManifest {
  readonly model: { path: string; metadata: string; fileDataId: number };
  readonly textureDirectory: string;
  /** Texture type to file id. */
  readonly textures: Readonly<Record<string, number>>;
  readonly look?: null;
}

/** A creature the game draws as a character: a baked look. */
interface CharacterBossManifest {
  readonly look: string;
}

/** What the baker writes to `bosses/v1/{displayId}.json`. */
export type BossManifest = {
  readonly schemaVersion: number;
  readonly displayId: number;
} & (CreatureBossManifest | CharacterBossManifest);

export interface BossStageOptions {
  readonly displayId: number;
  readonly assetBase: string;
  readonly onState: (state: BossState) => void;
}

export const bossManifestPath = (displayId: number): string =>
  `bosses/v1/${String(displayId)}.json`;

async function loadBoss(options: BossStageOptions): Promise<StandaloneModel> {
  const response = await fetch(
    resolveAsset(options.assetBase, bossManifestPath(options.displayId)),
    // Revalidates past an old 404 that was cached as immutable.
    { cache: "no-cache" },
  );
  if (!response.ok)
    throw new Error(
      `boss ${String(options.displayId)}: HTTP ${String(response.status)}`,
    );
  const manifest = (await response.json()) as BossManifest;
  return typeof manifest.look === "string"
    ? loadCharacterModel(manifest.look, options.assetBase)
    : loadCreature(manifest, options.assetBase);
}

function loadCreature(
  manifest: CreatureBossManifest,
  assetBase: string,
): Promise<StandaloneModel> {
  const asset = (path: string) => resolveAsset(assetBase, path);
  const modelDirectory = manifest.model.path.replace(/[^/]+$/, "");
  const replacements = Object.fromEntries(
    Object.entries(manifest.textures).map(([type, id]) => [Number(type), id]),
  );
  return buildStandaloneModels(
    [{ fileDataId: manifest.model.fileDataId, replacements }],
    {
      model: (id, extension) =>
        asset(`${modelDirectory}${String(id)}.${extension}`),
      texture: (id) => asset(`${manifest.textureDirectory}${String(id)}.png`),
    },
    1,
  );
}

/** Mounts an animated boss into `canvas`; returns the teardown. */
export function mountBossStage(
  canvas: HTMLCanvasElement,
  options: BossStageOptions,
): () => void {
  return mountModelStage(canvas, () => loadBoss(options), options.onState);
}
