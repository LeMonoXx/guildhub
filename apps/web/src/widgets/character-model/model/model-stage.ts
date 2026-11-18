import * as THREE from "three";
import { resolveAsset } from "../lib/look-assets";
import { createViewerRenderer, followSize } from "../lib/viewer-renderer";
import type { StandaloneModel } from "./build-held-item";
import { prepareCharacter } from "./prepare-character";

export type ModelStageState = "loading" | "ready" | "missing";

/** Turned a little away from the camera so the model reads in three quarters. */
const THREE_QUARTER_YAW = -0.5;
const SWAY_RADIANS = 0.1;
const SWAY_SECONDS = 7;

/**
 * A baked look as a standalone model, playing the first of `animationIds`
 * the look has; Stand otherwise.
 */
export async function loadCharacterModel(
  manifest: string,
  assetBase: string,
  animationIds: readonly number[] = [],
): Promise<StandaloneModel> {
  const { character } = await prepareCharacter({
    manifest: resolveAsset(assetBase, manifest),
    assetBase,
  });
  animationIds.some((id) => character.selectAnimationGroup(id));
  const object = new THREE.Group();
  object.add(character.root);
  return {
    object,
    update: (delta) => {
      character.update(delta);
    },
    dispose: () => {
      character.dispose();
    },
  };
}

/** Fits the whole model into view from the front, its feet at the bottom edge. */
function frameModel(
  model: StandaloneModel,
  camera: THREE.PerspectiveCamera,
): void {
  const bounds = new THREE.Box3().setFromObject(model.object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.object.position.set(-center.x, -bounds.min.y, -center.z);
  // The sway turns the model, so its footprint's diagonal is the widest it ever gets.
  const footprint = Math.max(Math.hypot(size.x, size.z), 0.5);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfWidth = halfHeight * camera.aspect;
  const distance =
    Math.max(size.y / 2 / halfHeight, footprint / 2 / halfWidth) * 1.1 +
    footprint / 2;
  camera.position.set(distance, size.y * 0.55, 0);
  camera.lookAt(0, size.y * 0.5, 0);
}

/** Mounts one animated model into `canvas`; returns the teardown. */
export function mountModelStage(
  canvas: HTMLCanvasElement,
  load: () => Promise<StandaloneModel>,
  onState: (state: ModelStageState) => void,
): () => void {
  const lifecycle = { disposed: false };
  onState("loading");
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
  let model: StandaloneModel | undefined;
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
      model?.update(delta);
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };

  void load()
    .then((loaded) => {
      if (lifecycle.disposed) {
        loaded.dispose();
        return;
      }
      model = loaded;
      pivot.add(loaded.object);
      frameModel(loaded, camera);
      onState("ready");
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    })
    .catch(() => {
      if (!lifecycle.disposed) onState("missing");
    });

  return () => {
    lifecycle.disposed = true;
    cancelAnimationFrame(frame);
    stopFollowing();
    model?.dispose();
    renderer.dispose();
  };
}
