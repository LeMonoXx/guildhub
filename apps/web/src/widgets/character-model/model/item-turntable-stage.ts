import * as THREE from "three";
import { fetchFixedLook, lookAssets } from "../lib/look-assets";
import { createViewerRenderer, followSize } from "../lib/viewer-renderer";
import { buildHeldItem, type HeldItem } from "./build-held-item";
import { itemDisplayModels } from "./item-models";

export type TurntableState = "loading" | "ready" | "plain";

export interface TurntableSpin {
  /** Current yaw in radians; the pointer and the idle spin both turn it. */
  yaw: number;
  dragging: boolean;
}

export interface ItemTurntableOptions {
  readonly manifest: string;
  readonly itemId: number;
  readonly assetBase: string;
  readonly spin: TurntableSpin;
  readonly onState: (state: TurntableState) => void;
}

const IDLE_SPIN_PER_SECOND = 0.35;

/** Places the camera so the whole item fits, centred on the pivot. */
function frameItem(held: HeldItem, camera: THREE.PerspectiveCamera): void {
  const bounds = new THREE.Box3().setFromObject(held.object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  held.object.position.sub(center);
  const radius = Math.max(size.x, size.y, size.z, 0.2);
  camera.position.set(0, radius * 0.08, radius * 2.6);
  camera.lookAt(0, 0, 0);
}

/** Armor that is only a body texture has no model of its own and stays plain. */
async function loadHeldItem(
  options: ItemTurntableOptions,
): Promise<HeldItem | undefined> {
  const look = await fetchFixedLook(
    options.manifest,
    globalThis.fetch.bind(globalThis),
  );
  const item = look.items.find((entry) => entry.itemId === options.itemId);
  const models = item === undefined ? [] : itemDisplayModels(item);
  if (models.length === 0) return undefined;
  const { model, texture } = lookAssets(look, options.assetBase);
  return buildHeldItem(models, { model, texture });
}

/** Mounts a turning item into `canvas`; returns the teardown. */
export function mountItemTurntable(
  canvas: HTMLCanvasElement,
  options: ItemTurntableOptions,
): () => void {
  const lifecycle = { disposed: false };
  const cancelled = () => lifecycle.disposed;
  options.onState("loading");
  const renderer = createViewerRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 80);
  const key = new THREE.DirectionalLight(0xfff1cc, 1.6);
  key.position.set(2.2, 3.4, 4);
  scene.add(new THREE.HemisphereLight(0xfff6e4, 0x2a2118, 1.15), key);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const stopFollowing = followSize(canvas, renderer, camera);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let held: HeldItem | undefined;
  let frame = 0;
  let previous = 0;

  const tick = (now: number) => {
    if (cancelled()) return;
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (!options.spin.dragging && !reduced)
      options.spin.yaw += delta * IDLE_SPIN_PER_SECOND;
    pivot.rotation.y = options.spin.yaw;
    held?.update(delta);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };

  void loadHeldItem(options)
    .then((loaded) => {
      if (cancelled()) {
        loaded?.dispose();
        return;
      }
      if (!loaded) {
        options.onState("plain");
        return;
      }
      held = loaded;
      pivot.add(loaded.object);
      frameItem(loaded, camera);
      options.onState("ready");
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    })
    .catch(() => {
      if (!cancelled()) options.onState("plain");
    });

  return () => {
    lifecycle.disposed = true;
    cancelAnimationFrame(frame);
    stopFollowing();
    held?.dispose();
    renderer.dispose();
  };
}
