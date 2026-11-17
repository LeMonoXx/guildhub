import * as THREE from "three";
import { resolveAsset } from "../lib/look-assets";
import { createViewerRenderer, followSize } from "../lib/viewer-renderer";
import { buildStandaloneModels, type StandaloneModel } from "./build-held-item";

export type BossState = "loading" | "ready" | "missing";

/** What the baker writes to `bosses/v1/{displayId}.json`. */
export interface BossManifest {
  readonly schemaVersion: number;
  readonly displayId: number;
  readonly model: { path: string; metadata: string; fileDataId: number };
  readonly textureDirectory: string;
  /** Texture type to file id: the skins this display puts on the model. */
  readonly textures: Readonly<Record<string, number>>;
}

export interface BossStageOptions {
  readonly displayId: number;
  readonly assetBase: string;
  readonly onState: (state: BossState) => void;
}

export const bossManifestPath = (displayId: number): string =>
  `bosses/v1/${String(displayId)}.json`;

/** Turned a little away from the camera so the boss reads in three quarters. */
const THREE_QUARTER_YAW = -0.5;
const SWAY_RADIANS = 0.1;
const SWAY_SECONDS = 7;

async function loadBoss(options: BossStageOptions): Promise<StandaloneModel> {
  const response = await fetch(
    resolveAsset(options.assetBase, bossManifestPath(options.displayId)),
  );
  if (!response.ok)
    throw new Error(
      `boss ${String(options.displayId)}: HTTP ${String(response.status)}`,
    );
  const manifest = (await response.json()) as BossManifest;
  const asset = (path: string) => resolveAsset(options.assetBase, path);
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

/** Fits the whole boss into view from the front, its feet at the bottom edge. */
function frameBoss(
  boss: StandaloneModel,
  camera: THREE.PerspectiveCamera,
): void {
  const bounds = new THREE.Box3().setFromObject(boss.object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  boss.object.position.set(-center.x, -bounds.min.y, -center.z);
  // The sway turns the boss, so its footprint's diagonal is the widest it ever gets.
  const footprint = Math.max(Math.hypot(size.x, size.z), 0.5);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfWidth = halfHeight * camera.aspect;
  const distance =
    Math.max(size.y / 2 / halfHeight, footprint / 2 / halfWidth) * 1.1 +
    footprint / 2;
  camera.position.set(distance, size.y * 0.55, 0);
  camera.lookAt(0, size.y * 0.5, 0);
}

/** Mounts an animated boss into `canvas`; returns the teardown. */
export function mountBossStage(
  canvas: HTMLCanvasElement,
  options: BossStageOptions,
): () => void {
  const lifecycle = { disposed: false };
  options.onState("loading");
  const renderer = createViewerRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
  key.position.set(4, 5, -2);
  const rim = new THREE.DirectionalLight(0x9f6bff, 1.4);
  rim.position.set(-4, 3, 3);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a1220, 1.5), key, rim);
  const pivot = new THREE.Group();
  pivot.rotation.y = THREE_QUARTER_YAW;
  scene.add(pivot);
  const stopFollowing = followSize(canvas, renderer, camera);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let boss: StandaloneModel | undefined;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;

  const tick = (now: number) => {
    if (lifecycle.disposed) return;
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    elapsed += delta;
    if (!reduced) {
      pivot.rotation.y =
        THREE_QUARTER_YAW +
        Math.sin((elapsed / SWAY_SECONDS) * Math.PI * 2) * SWAY_RADIANS;
      boss?.update(delta);
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };

  void loadBoss(options)
    .then((loaded) => {
      if (lifecycle.disposed) {
        loaded.dispose();
        return;
      }
      boss = loaded;
      pivot.add(loaded.object);
      frameBoss(loaded, camera);
      options.onState("ready");
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    })
    .catch(() => {
      if (!lifecycle.disposed) options.onState("missing");
    });

  return () => {
    lifecycle.disposed = true;
    cancelAnimationFrame(frame);
    stopFollowing();
    boss?.dispose();
    renderer.dispose();
  };
}
