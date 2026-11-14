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

/**
 * Posed world positions of the vertices the visible meshes actually draw.
 * Bounding boxes and bones won't do: every geoset variant shares one vertex
 * buffer and skeleton.
 */
const drawnVertices = (root: THREE.Object3D): THREE.Vector3[] => {
  root.updateMatrixWorld(true);
  const vertices: THREE.Vector3[] = [];
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const count =
      geometry.index?.count ?? geometry.getAttribute("position").count;
    for (let i = 0; i < count; i += 1) {
      const vertex = new THREE.Vector3();
      object.getVertexPosition(geometry.index?.getX(i) ?? i, vertex);
      vertices.push(vertex.applyMatrix4(object.matrixWorld));
    }
  });
  return vertices;
};

/**
 * Share of the frame's half width the framed body may fill; above one, as
 * weapons and pauldrons may run off the edge.
 */
const widthShare = 1.2;

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
  private cameraScale = 1;
  /** How much further back along the view than the scaled pose. */
  private cameraBack = 1;
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

  /**
   * Scales every camera pose about the floor origin so the framing written
   * for a body `assumedHeight` tall (unscaled) holds whatever the body
   * measures: by the posed crown height, and further out when the part of the
   * body in frame is too broad for it, as with a tauren's hump.
   * Call it once the scene's pose and camera are applied.
   */
  fitCameraTo(assumedHeight: number): void {
    const actors = [...this.actors.values()];
    const vertices = actors.flatMap(({ root }) => drawnVertices(root));
    const scale = Math.max(...actors.map(({ root }) => root.scale.y), 1e-6);
    const crown = Math.max(...vertices.map((vertex) => vertex.y)) / scale;
    if (!(crown > 0) || !(assumedHeight > 0)) return;
    const tall = crown / assumedHeight;
    const reach = Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    const distance =
      this.camera.position.distanceTo(this.cameraTarget) /
      (this.cameraScale * this.cameraBack);
    const target = this.cameraTarget.y / this.cameraScale;
    const frameBottom = (target - reach * distance) * tall;
    const halfWidth = Math.max(
      0,
      ...vertices
        .filter((vertex) => vertex.y >= frameBottom)
        .map((vertex) => Math.abs(vertex.x)),
    );
    const framedHalfWidth = reach * distance * tall * this.camera.aspect;
    this.cameraScale = Math.min(Math.max(tall, 0.5), 2);
    this.cameraBack = Math.min(
      Math.max(halfWidth / (framedHalfWidth * widthShare), 1),
      1.6,
    );
  }

  setCamera(
    position: Readonly<{ x: number; y: number; z: number }>,
    target: Readonly<{ x: number; y: number; z: number }>,
    fov: number,
  ): void {
    const scale = this.cameraScale;
    this.cameraTarget.set(target.x * scale, target.y * scale, target.z * scale);
    this.camera.position
      .set(position.x * scale, position.y * scale, position.z * scale)
      .sub(this.cameraTarget)
      .multiplyScalar(this.cameraBack)
      .add(this.cameraTarget);
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
