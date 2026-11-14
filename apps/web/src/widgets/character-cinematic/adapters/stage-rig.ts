import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CharacterHandle } from "../../character-model";

export interface StageRigOptions {
  readonly orbitControls?: boolean;
  readonly alpha?: boolean;
  readonly renderer?: THREE.WebGLRenderer;
  readonly resizeObserver?: (resize: () => void) => {
    observe(target: Element): void;
    disconnect(): void;
  };
}

/**
 * The container's vertical padding is drawn into but not framed: the camera
 * frames the content box, so figures can reach past it without shrinking.
 */
const verticalBleed = (container: HTMLElement) => {
  if (typeof Element === "undefined" || !(container instanceof Element))
    return { top: 0, bottom: 0 };
  const style = getComputedStyle(container);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
  };
};

export class StageRig {
  readonly scene = new THREE.Scene();
  readonly background = new THREE.Color(0x000000);
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  readonly cameraTarget = new THREE.Vector3();
  readonly actorRoot = new THREE.Group();
  readonly effectRoot = new THREE.Group();
  readonly lights = new Map<string, THREE.Light>();
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;

  private readonly observer: {
    observe(target: Element): void;
    disconnect(): void;
  };
  private readonly controls?: OrbitControls;
  private readonly actors = new Map<string, CharacterHandle>();
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    options: StageRigOptions = {},
  ) {
    const alpha = options.alpha === true;
    this.canvas =
      options.renderer?.domElement ?? document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    if (!this.canvas.parentElement) container.append(this.canvas);
    this.renderer =
      options.renderer ??
      new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha,
        premultipliedAlpha: alpha,
      });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (alpha) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setClearAlpha(0);
    }

    this.scene.name = "cinematic-stage";
    this.scene.background = alpha ? null : this.background;
    this.actorRoot.name = "actors";
    this.effectRoot.name = "effects";
    this.scene.add(this.actorRoot, this.effectRoot);
    this.addLight(
      "ambient",
      new THREE.HemisphereLight(0x8899aa, 0x000000, 0.25),
    );
    this.addLight("key", new THREE.DirectionalLight(0xffffff, 0));
    this.addLight("fill", new THREE.DirectionalLight(0x7799bb, 0));

    if (options.orbitControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.target.copy(this.cameraTarget);
    }

    const resize = () => {
      this.resize();
    };
    this.observer = options.resizeObserver
      ? options.resizeObserver(resize)
      : new ResizeObserver(resize);
    this.observer.observe(container);
    this.resize();
  }

  private addLight(name: string, light: THREE.Light): void {
    light.name = name;
    this.lights.set(name, light);
    this.scene.add(light);
  }

  addActor(id: string, actor: CharacterHandle): void {
    if (this.disposed) {
      actor.dispose();
      return;
    }
    const existing = this.actors.get(id);
    if (existing === actor) return;
    if (existing) {
      this.actorRoot.remove(existing.root);
      existing.dispose();
    }
    this.actors.set(id, actor);
    this.actorRoot.add(actor.root);
  }

  setActor(actor: CharacterHandle): void {
    this.clearActors();
    this.addActor("actor", actor);
  }

  clearActors(): void {
    for (const actor of this.actors.values()) {
      this.actorRoot.remove(actor.root);
      actor.dispose();
    }
    this.actors.clear();
  }

  actorCount(): number {
    return this.actors.size;
  }

  setCamera(
    position: Readonly<{ x: number; y: number; z: number }>,
    target: Readonly<{ x: number; y: number; z: number }>,
    fov: number,
  ): void {
    this.camera.position.set(position.x, position.y, position.z);
    this.cameraTarget.set(target.x, target.y, target.z);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cameraTarget);
    if (this.controls) {
      this.controls.target.copy(this.cameraTarget);
      this.controls.update();
    }
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const bleed = verticalBleed(this.container);
    const framed = Math.max(height - bleed.top - bleed.bottom, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / framed;
    if (bleed.top > 0 || bleed.bottom > 0)
      this.camera.setViewOffset(width, framed, 0, -bleed.top, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.disposed) return;
    for (const actor of this.actors.values()) actor.faceCamera(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  async prewarm(): Promise<void> {
    if (this.disposed) return;
    await this.renderer.compileAsync(this.scene, this.camera);
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.controls?.dispose();
    this.clearActors();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
