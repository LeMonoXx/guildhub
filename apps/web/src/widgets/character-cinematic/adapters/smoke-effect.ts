import * as THREE from "three";

export interface SmokeValues {
  readonly density: number;
  readonly drift: Readonly<{ x: number; y: number; z: number }>;
  readonly size: number;
  readonly opacity: number;
}

const vertexShader = `
attribute float particleOpacity;
attribute float particleSize;
attribute float particleSeed;
varying float vOpacity;
varying float vSeed;
void main() {
  vOpacity = particleOpacity;
  vSeed = particleSeed;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = particleSize * (12.0 / max(1.0, -view.z));
  gl_Position = projectionMatrix * view;
}`;

const fragmentShader = `
varying float vOpacity;
varying float vSeed;

float random(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(random(cell), random(cell + vec2(1.0, 0.0)), blend.x),
    mix(
      random(cell + vec2(0.0, 1.0)),
      random(cell + vec2(1.0, 1.0)),
      blend.x
    ),
    blend.y
  );
}

float fbm(vec2 point) {
  float value = 0.0;
  value += noise(point) * 0.5333;
  point = point * 2.03 + 17.17;
  value += noise(point) * 0.2667;
  point = point * 2.01 + 9.23;
  value += noise(point) * 0.1333;
  point = point * 2.04 + 5.91;
  value += noise(point) * 0.0667;
  return value;
}

void main() {
  vec2 center = (gl_PointCoord - vec2(0.5)) * 2.0;
  float detail = fbm(gl_PointCoord * 3.4 + vec2(vSeed * 11.0, vSeed * 7.0));
  float distortedRadius = length(center) - (detail - 0.5) * 0.34;
  float envelope = 1.0 - smoothstep(0.38, 1.02, distortedRadius);
  float wisps = smoothstep(0.16, 0.86, detail);
  float alpha = envelope * (0.48 + wisps * 0.52) * vOpacity * 0.24;
  vec3 color = mix(vec3(0.16, 0.17, 0.2), vec3(0.34, 0.36, 0.4), detail);
  gl_FragColor = vec4(color, alpha);
}`;

const randomSequence = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

export class SmokeEffect {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly positionAttribute: THREE.BufferAttribute;
  readonly opacityAttribute: THREE.BufferAttribute;
  readonly sizeAttribute: THREE.BufferAttribute;
  readonly seedAttribute: THREE.BufferAttribute;

  private readonly origins: Float32Array;
  private readonly phases: Float32Array;
  private values: SmokeValues = {
    density: 0,
    drift: { x: 0, y: 0, z: 0 },
    size: 0,
    opacity: 0,
  };
  private timeMs = 0;
  private disposed = false;

  constructor(
    readonly seed: number,
    readonly capacity = 256,
  ) {
    const random = randomSequence(seed);
    this.origins = new Float32Array(capacity * 3);
    this.phases = new Float32Array(capacity);
    const positions = new Float32Array(capacity * 3);
    const opacities = new Float32Array(capacity);
    const sizes = new Float32Array(capacity);
    for (let index = 0; index < capacity; index += 1) {
      const offset = index * 3;
      this.origins[offset] = random() * 2 - 1;
      this.origins[offset + 1] = random() * 0.8;
      this.origins[offset + 2] = random() * 2 - 1;
      this.phases[index] = random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(positions, 3);
    this.opacityAttribute = new THREE.BufferAttribute(opacities, 1);
    this.sizeAttribute = new THREE.BufferAttribute(sizes, 1);
    this.seedAttribute = new THREE.BufferAttribute(this.phases, 1);
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("particleOpacity", this.opacityAttribute);
    this.geometry.setAttribute("particleSize", this.sizeAttribute);
    this.geometry.setAttribute("particleSeed", this.seedAttribute);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "authored-smoke";
    this.points.renderOrder = 20;
    // Particle positions move independently of the prewarmed zeroed buffer, so
    // a cached bounding sphere would incorrectly cull the whole effect.
    this.points.frustumCulled = false;
  }

  apply(values: SmokeValues, timeMs: number): void {
    this.values = values;
    this.setTime(timeMs);
  }

  setTime(timeMs: number): void {
    if (this.disposed) return;
    this.timeMs = Math.max(0, timeMs);
    const seconds = this.timeMs / 1000;
    const positions = this.positionAttribute.array as Float32Array;
    const opacities = this.opacityAttribute.array as Float32Array;
    const sizes = this.sizeAttribute.array as Float32Array;
    const count = Math.round(
      Math.min(Math.max(this.values.density, 0), 1) * this.capacity,
    );
    for (let index = 0; index < this.capacity; index += 1) {
      const offset = index * 3;
      const phase = this.phases[index] ?? 0;
      const originX = this.origins[offset] ?? 0;
      const originY = this.origins[offset + 1] ?? 0;
      const originZ = this.origins[offset + 2] ?? 0;
      const age = (seconds * 0.17 + phase) % 1;
      positions[offset] = originX + this.values.drift.x * seconds + age * 0.1;
      positions[offset + 1] =
        originY + this.values.drift.y * seconds + age * 0.6;
      positions[offset + 2] = originZ + this.values.drift.z * seconds;
      opacities[index] =
        index < count ? this.values.opacity * (1 - age * 0.65) : 0;
      sizes[index] = this.values.size * (0.65 + phase * 0.7);
    }
    this.geometry.setDrawRange(0, count);
    this.positionAttribute.needsUpdate = true;
    this.opacityAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
  }

  reset(): void {
    this.setTime(0);
  }

  get time(): number {
    return this.timeMs;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }
}
