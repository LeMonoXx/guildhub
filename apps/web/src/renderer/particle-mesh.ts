// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Particle semantics follow wowdev.wiki and WebWowViewerCpp.

import * as THREE from "three";
import type { ParticleEmitterMeta } from "../types";
import { m2Blend } from "./m2-material";
import {
  MAX_PARTICLES,
  advance,
  appearance,
  simulateTo,
  type EmitterState,
} from "./particles";

const vertexShader = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aCell;
uniform float uViewportHeight;
uniform float uScale;
varying vec4 vColor;
varying float vCell;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uScale * projectionMatrix[1][1] * uViewportHeight / max(-mv.z, 1e-4), 0.0);
  vColor = aColor;
  vCell = aCell;
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform bool uHasMap;
uniform float uRows;
uniform float uColumns;
varying vec4 vColor;
varying float vCell;
void main() {
  vec2 cell = vec2(mod(vCell, uColumns), floor(vCell / uColumns));
  vec2 uv = (cell + gl_PointCoord) / vec2(uColumns, uRows);
  vec4 c = (uHasMap ? texture2D(uMap, uv) : vec4(1.0)) * vColor;
  if (c.a <= 0.0) discard;
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

export interface ParticleMesh {
  object: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  update(delta: number): void;
  setTime(time: number): void;
  dispose(): void;
}

export function createParticleMesh(
  emitter: ParticleEmitterMeta,
  texture: THREE.Texture | null,
  seed: number,
): ParticleMesh {
  const position = new THREE.BufferAttribute(
    new Float32Array(MAX_PARTICLES * 3),
    3,
  );
  const color = new THREE.BufferAttribute(
    new Float32Array(MAX_PARTICLES * 4),
    4,
  );
  const size = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1);
  const cell = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1);
  for (const attribute of [position, color, size, cell])
    attribute.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("aColor", color);
  geometry.setAttribute("aSize", size);
  geometry.setAttribute("aCell", cell);
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uMap: { value: texture },
      uHasMap: { value: texture !== null },
      uRows: { value: emitter.rows },
      uColumns: { value: emitter.columns },
      uViewportHeight: { value: 1 },
      uScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    ...m2Blend(emitter.blendMode),
  });
  material.transparent = true;

  const object = new THREE.Points(geometry, material);
  object.name = `particles_${String(emitter.index)}`;
  object.position.fromArray(emitter.offsetGltf);
  object.frustumCulled = false;
  const viewport = new THREE.Vector4();
  object.onBeforeRender = (renderer) => {
    const viewportHeight = material.uniforms.uViewportHeight;
    const scale = material.uniforms.uScale;
    if (viewportHeight)
      viewportHeight.value = renderer.getCurrentViewport(viewport).w;
    if (scale) scale.value = object.matrixWorld.getMaxScaleOnAxis();
  };

  const linear = new THREE.Color();
  let state: EmitterState = simulateTo(emitter, seed, 0);
  const write = () => {
    for (const [index, particle] of state.particles.entries()) {
      const appearanceAtTime = appearance(emitter, particle);
      position.setXYZ(
        index,
        particle.pos[0] ?? 0,
        particle.pos[1] ?? 0,
        particle.pos[2] ?? 0,
      );
      linear.setRGB(
        appearanceAtTime.color[0] ?? 1,
        appearanceAtTime.color[1] ?? 1,
        appearanceAtTime.color[2] ?? 1,
        THREE.SRGBColorSpace,
      );
      color.setXYZW(
        index,
        linear.r,
        linear.g,
        linear.b,
        appearanceAtTime.alpha,
      );
      size.setX(index, appearanceAtTime.size);
      cell.setX(index, appearanceAtTime.cell);
    }
    geometry.setDrawRange(0, state.particles.length);
    for (const attribute of [position, color, size, cell])
      attribute.needsUpdate = true;
  };

  return {
    object,
    update(delta) {
      advance(state, delta);
      write();
    },
    setTime(time) {
      state = simulateTo(emitter, seed, time);
      write();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
