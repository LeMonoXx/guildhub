import { teleportFlashProgress } from "@guildhub/contracts";
import * as THREE from "three";

export interface TeleportValues {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly progress: number;
  readonly tint: Readonly<{ x: number; y: number; z: number }>;
}

/** How strong each part of the effect is at one point of the arrival. */
export interface TeleportEnvelope {
  readonly beam: number;
  readonly beamHeight: number;
  readonly ring: number;
  readonly ringScale: number;
  readonly flash: number;
  readonly sparks: number;
}

const teleportFlashAt = teleportFlashProgress;

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Charge, flash, fade: everything rises toward the flash and dies away after it. */
export const teleportEnvelope = (progress: number): TeleportEnvelope => {
  const rise = smooth(0, teleportFlashAt, progress);
  const fade = 1 - smooth(teleportFlashAt, 1, progress);
  const flashRise = smooth(teleportFlashAt - 0.1, teleportFlashAt, progress);
  const flashFall =
    1 - smooth(teleportFlashAt, teleportFlashAt + 0.14, progress);
  return {
    beam: rise * fade,
    beamHeight: 0.15 + 0.85 * rise,
    ring: rise * (1 - smooth(teleportFlashAt, 0.8, progress)),
    ringScale: 0.35 + 0.65 * rise + 0.5 * smooth(teleportFlashAt, 1, progress),
    flash: flashRise * flashFall,
    sparks: smooth(0.15, teleportFlashAt, progress) * fade,
  };
};

const beamHeight = 3.4;
const beamRadius = 0.62;
const sparkCount = 90;

const beamVertex = `
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-view.xyz);
  gl_Position = projectionMatrix * view;
}`;

const beamFragment = `
uniform vec3 uTint;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  float rim = 1.0 - abs(dot(vNormalView, vViewDir));
  float body = 0.35 + 0.65 * pow(rim, 1.6);
  float base = smoothstep(0.0, 0.08, vUv.y);
  float top = 1.0 - smoothstep(0.35, 1.0, vUv.y);
  float streaks = 0.65 + 0.35 * sin(vUv.x * 62.0 + vUv.y * 9.0 - uTime * 7.0);
  float alpha = body * base * top * streaks * uIntensity;
  gl_FragColor = vec4(mix(uTint, vec3(1.0), 0.35 * top), alpha);
}`;

const ringFragment = `
uniform vec3 uTint;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float radius = length(vUv - vec2(0.5)) * 2.0;
  float band = smoothstep(0.55, 0.8, radius) * (1.0 - smoothstep(0.8, 1.0, radius));
  float glow = (1.0 - smoothstep(0.0, 0.85, radius)) * 0.35;
  gl_FragColor = vec4(mix(uTint, vec3(1.0), band * 0.4), (band + glow) * uIntensity);
}`;

const planeVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const sparkVertex = `
attribute float seed;
uniform float uTime;
uniform float uIntensity;
varying float vAlpha;
void main() {
  float age = fract(uTime * (0.35 + seed * 0.45) + seed * 7.13);
  float angle = seed * 43.7 + uTime * (0.6 + seed);
  float radius = ${beamRadius.toFixed(2)} * (0.35 + 0.65 * fract(seed * 13.1));
  vec3 lifted = vec3(cos(angle) * radius, age * ${beamHeight.toFixed(2)}, sin(angle) * radius);
  vAlpha = uIntensity * (1.0 - age) * smoothstep(0.0, 0.1, age);
  vec4 view = modelViewMatrix * vec4(lifted, 1.0);
  gl_PointSize = (2.0 + seed * 3.5) * (14.0 / max(1.0, -view.z));
  gl_Position = projectionMatrix * view;
}`;

const sparkFragment = `
uniform vec3 uTint;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  gl_FragColor = vec4(mix(uTint, vec3(1.0), 0.6), (1.0 - smoothstep(0.2, 1.0, d)) * vAlpha);
}`;

const flashVertex = `
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 900.0 / max(1.0, -view.z);
  gl_Position = projectionMatrix * view;
}`;

const flashFragment = `
uniform vec3 uTint;
uniform float uIntensity;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float core = 1.0 - smoothstep(0.0, 1.0, d);
  gl_FragColor = vec4(mix(uTint, vec3(1.0), core), core * core * uIntensity);
}`;

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const tintOf = (material: THREE.ShaderMaterial): THREE.Color =>
  (material.uniforms.uTint as THREE.IUniform<THREE.Color>).value;

const setUniform = (
  material: THREE.ShaderMaterial,
  name: string,
  value: number,
) => {
  (material.uniforms[name] as THREE.IUniform<number>).value = value;
};

const additive = (vertexShader: string, fragmentShader: string) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTint: { value: new THREE.Color(1, 1, 1) },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

/**
 * A procedural arrival: a column of light charges up, flashes as the hero
 * appears inside it, and fades while sparks drift upward.
 */
export class TeleportEffect {
  readonly root = new THREE.Group();
  private readonly beam: THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.ShaderMaterial
  >;
  private readonly ring: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly flash: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private readonly sparks: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private readonly materials: readonly THREE.ShaderMaterial[];
  private disposed = false;

  constructor(seed: number) {
    const beamGeometry = new THREE.CylinderGeometry(
      beamRadius,
      beamRadius * 0.8,
      beamHeight,
      40,
      1,
      true,
    );
    beamGeometry.translate(0, beamHeight / 2, 0);
    this.beam = new THREE.Mesh(
      beamGeometry,
      additive(beamVertex, beamFragment),
    );

    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      additive(planeVertex, ringFragment),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;

    const flashGeometry = new THREE.BufferGeometry();
    flashGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 1.2, 0]), 3),
    );
    this.flash = new THREE.Points(
      flashGeometry,
      additive(flashVertex, flashFragment),
    );
    this.flash.frustumCulled = false;

    const sparkGeometry = new THREE.BufferGeometry();
    const random = seededRandom(seed);
    const seeds = Float32Array.from({ length: sparkCount }, () => random());
    sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(sparkCount * 3), 3),
    );
    sparkGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    this.sparks = new THREE.Points(
      sparkGeometry,
      additive(sparkVertex, sparkFragment),
    );
    this.sparks.frustumCulled = false;

    this.materials = [
      this.beam.material,
      this.ring.material,
      this.flash.material,
      this.sparks.material,
    ];
    this.root.name = "teleport";
    this.root.renderOrder = 30;
    this.root.visible = false;
    this.root.add(this.ring, this.beam, this.sparks, this.flash);
  }

  apply(values: TeleportValues, timeMs: number): void {
    if (this.disposed) return;
    const active = values.progress > 0 && values.progress < 1;
    this.root.visible = active;
    if (!active) return;
    const envelope = teleportEnvelope(values.progress);
    this.root.position.set(
      values.position.x,
      values.position.y,
      values.position.z,
    );
    for (const material of this.materials) {
      tintOf(material).setRGB(values.tint.x, values.tint.y, values.tint.z);
      setUniform(material, "uTime", timeMs / 1000);
    }
    setUniform(this.beam.material, "uIntensity", envelope.beam);
    setUniform(this.ring.material, "uIntensity", envelope.ring);
    setUniform(this.flash.material, "uIntensity", envelope.flash);
    setUniform(this.sparks.material, "uIntensity", envelope.sparks);
    this.beam.scale.set(1, envelope.beamHeight, 1);
    this.ring.scale.setScalar(envelope.ringScale);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.beam.geometry.dispose();
    this.ring.geometry.dispose();
    this.flash.geometry.dispose();
    this.sparks.geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
