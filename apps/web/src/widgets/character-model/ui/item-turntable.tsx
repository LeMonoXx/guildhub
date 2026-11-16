import type { ItemQuality } from "@guildhub/contracts";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ItemIcon } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { buildHeldItem, type HeldItem } from "../model/assemble-character";
import { itemDisplayModels } from "../model/item-models";
import type { FixedLookManifest } from "../model/types";

export interface ItemTurntableProps {
  readonly manifest: string;
  readonly itemId: number;
  readonly assetBase: string;
  readonly iconUrl?: string;
  readonly quality?: ItemQuality;
}

const resolveAsset = (base: string, path: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("/")) return path;
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
};

type Stage = "loading" | "ready" | "plain";

/** The selected item, turned by the pointer. Armor that is only a body texture stays an icon. */
export function ItemTurntable({
  manifest,
  itemId,
  assetBase,
  iconUrl,
  quality,
}: ItemTurntableProps) {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yaw = useRef(0.5);
  const dragging = useRef(false);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lifecycle = { disposed: false };
    const cancelled = () => lifecycle.disposed;
    setStage("loading");
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 80);
    const hemi = new THREE.HemisphereLight(0xfff6e4, 0x2a2118, 1.15);
    const key = new THREE.DirectionalLight(0xfff1cc, 1.6);
    key.position.set(2.2, 3.4, 4);
    scene.add(hemi, key);
    const pivot = new THREE.Group();
    scene.add(pivot);
    let held: HeldItem | undefined;
    let frame = 0;
    let previous = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fit = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();

    const tick = (now: number) => {
      if (lifecycle.disposed) return;
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!dragging.current && !reduced) yaw.current += delta * 0.35;
      pivot.rotation.y = yaw.current;
      held?.update(delta);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    void (async () => {
      try {
        const response = await fetch(manifest);
        if (!response.ok) throw new Error("look");
        const look = (await response.json()) as FixedLookManifest;
        const item = look.items.find((entry) => entry.itemId === itemId);
        const models = item === undefined ? [] : itemDisplayModels(item);
        if (cancelled()) return;
        if (models.length === 0 || !look.body.path) {
          setStage("plain");
          return;
        }
        const directory = look.body.path.replace(/[^/]+$/, "");
        const textures = directory.replace(/models\/$/, "textures/");
        const asset = (path: string) => resolveAsset(assetBase, path);
        held = await buildHeldItem(models, {
          model: (id, extension) =>
            asset(`${directory}${String(id)}.${extension}`),
          texture: (id) => asset(`${textures}${String(id)}.png`),
        });
        if (cancelled()) {
          held.dispose();
          return;
        }
        pivot.add(held.object);
        const bounds = new THREE.Box3().setFromObject(held.object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        held.object.position.sub(center);
        const radius = Math.max(size.x, size.y, size.z, 0.2);
        camera.position.set(0, radius * 0.08, radius * 2.6);
        camera.lookAt(0, 0, 0);
        setStage("ready");
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      } catch {
        if (!cancelled()) setStage("plain");
      }
    })();

    return () => {
      lifecycle.disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      held?.dispose();
      renderer.dispose();
    };
  }, [assetBase, itemId, manifest]);

  return (
    <div
      className="item-turntable"
      data-state={stage}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        yaw.current += event.movementX * 0.01;
      }}
    >
      <canvas ref={canvasRef} aria-hidden={stage !== "ready"} />
      {stage === "ready" ? (
        <p className="item-turntable-hint">{t("armory.turn")}</p>
      ) : (
        <div className="item-turntable-fallback">
          <ItemIcon iconUrl={iconUrl} quality={quality} size="lg" />
          <p>
            {stage === "loading"
              ? t("armory.modelLoading")
              : t("armory.modelOnBody")}
          </p>
        </div>
      )}
    </div>
  );
}
