/*
 * Page fog as a real fluid: a GPU solver for the incompressible Navier-Stokes
 * equations after Jos Stam's "Stable Fluids" (semi-Lagrangian advection,
 * Jacobi pressure projection) with vorticity confinement for curling wisps.
 *
 * Why custom code: no maintained package renders a translucent fog layer
 * without pulling in Three.js (which stays confined to the character adapters,
 * see web-three-adapter-boundary) or a full colour-splat demo. This file is the
 * smallest solver that gives the fog real motion: the pointer pushes and stirs
 * it, the wake swirls and slowly fills in again, scrolling drags it along.
 */

import { readFogFigures } from "./fog-channel";
import { FigureMotionTracker } from "./fog-motion";
import { readFogTuning } from "./fog-tuning";

export interface FluidFogOptions {
  readonly reducedMotion: boolean;
  /** Canvas pixels per CSS pixel for the final, lit image. */
  readonly resolution: number;
  /**
   * "page": the fog behind all content. "veil": the same fog in front of the
   * character stage, resting as a deep bank around the troop and nowhere else.
   */
  readonly layer?: "page" | "veil";
  /** The veil draws only inside this box (viewport pixels) and sleeps while it is off screen. */
  readonly region?: () => DOMRect | null;
  /** Veil opacity, 0 to 1. */
  readonly opacity?: number;
  /** How high the veil bank reaches: 1 is above the hips. */
  readonly depth?: number;
}

/** Velocity grid width; height follows the window's aspect ratio. */
const SIM_WIDTH = 176;
/** Fog density grid width; finer than the velocity grid for crisp wisps. */
const DYE_WIDTH = 384;
const PRESSURE_ITERATIONS = 18;
/** How strongly existing curls are reinforced. */
const CURL = 9;
const VELOCITY_DISSIPATION = 0.9;
/** Share of the resting fog restored per second where the pointer wiped it. */
const REFILL = 0.35;
/** Pointer push, in grid cells per second per unit of pointer travel. */
const SPLAT_FORCE = 2600;
const SPLAT_RADIUS = 0.0026;
/** How much fog the pointer core clears per second. */
const WIPE = 0.8;
/** Characters the solver follows at most (the lineup has six). */
const MAX_FIGURES = 8;

const vertexShader = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
uniform vec2 uTexel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const header = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
`;

const noise = /* glsl */ `
float square(float x) {
  return x * x;
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
`;

const curlShader = `${header}
uniform sampler2D uVelocity;
void main() {
  float l = texture(uVelocity, vL).y;
  float r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x;
  float b = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
`;

const vorticityShader = `${header}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float l = texture(uCurl, vL).x;
  float r = texture(uCurl, vR).x;
  float t = texture(uCurl, vT).x;
  float b = texture(uCurl, vB).x;
  float c = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * c;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

/* Ambient breeze (curl of a noise field, so it stays swirl-like), scrolling, and the pointer. */
const forceShader = `${header}
uniform sampler2D uVelocity;
uniform float uTime;
uniform float uAspect;
uniform float uDt;
uniform vec2 uPointer;
uniform vec2 uPush;
uniform float uRadius;
uniform float uScrollPush;
uniform vec4 uFigures[${String(MAX_FIGURES)}];
uniform vec2 uFigureVelocity[${String(MAX_FIGURES)}];
uniform int uFigureCount;
uniform float uFigureForce;
uniform float uLayer;
${noise}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 2.4 + vec2(uTime * 0.03, uTime * 0.011);
  float e = 0.02;
  float n1 = fbm(p + vec2(0.0, e));
  float n2 = fbm(p - vec2(0.0, e));
  float n3 = fbm(p + vec2(e, 0.0));
  float n4 = fbm(p - vec2(e, 0.0));
  vec2 breeze = vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity += (breeze * 12.0 + vec2(6.0, 1.0)) * uDt;
  velocity.y += uScrollPush;
  vec2 d = vUv - uPointer;
  d.x *= uAspect;
  velocity += uPush * exp(-dot(d, d) / uRadius);

  // Characters: a moving body carries the fog along and shoulders it aside;
  // feet keep stirring it a little even while standing.
  for (int i = 0; i < ${String(MAX_FIGURES)}; i++) {
    if (i >= uFigureCount) break;
    vec4 figure = uFigures[i];
    float height = max(figure.z - figure.y, 0.001);
    float up = (vUv.y - figure.y) / height;
    float across = (vUv.x - figure.x) / max(figure.w, 0.001);
    float body = exp(-across * across * 1.4)
      * smoothstep(-0.15, 0.05, up) * smoothstep(1.1, 0.55, up);
    // The stirred zone reaches well past the silhouette, so it shows around it.
    float aura = exp(-across * across * (uLayer > 0.5 ? 0.7 : 0.18))
      * smoothstep(-0.3, 0.05, up) * smoothstep(1.3, 0.4, up);
    float feet = exp(-across * across * 0.2) * exp(-square(up / 0.2));
    vec2 drag = uFigureVelocity[i];
    float moving = clamp(length(drag) / 15.0, 0.0, 1.0);
    // A walking body drags the fog along and leaves a long wake behind it.
    // In front, a standing body must not freeze the fog around it.
    float hold = uLayer > 0.5 ? moving : 1.0;
    velocity = mix(velocity, drag * 1.4, clamp(aura * uFigureForce * 0.4 * hold, 0.0, 0.95));
    if (uLayer > 0.5) {
      // Stirred fog rises from the feet in pulses and curls up the legs.
      float rise = exp(-across * across * 0.5) * smoothstep(-0.1, 0.05, up)
        * (1.0 - smoothstep(0.35, 1.1, up));
      float pulse = 0.55 + 0.45 * sin(uTime * 0.7 + float(i) * 1.9 - up * 7.0);
      velocity.y += rise * (2.0 + 12.0 * moving) * pulse * uFigureForce * uDt;
      velocity.x += rise * (noise(vec2(up * 5.0 - uTime * 0.6, float(i) * 3.7)) - 0.5)
        * (2.5 + 12.0 * moving) * uFigureForce * uDt;
    }
    float behind = exp(-square(across * 0.45)) * smoothstep(-0.2, 0.1, up) * smoothstep(1.0, 0.25, up);
    velocity += drag * behind * moving * 9.0 * uFigureForce * uDt;
    // Bodies shoulder the fog aside, out past their edges.
    velocity.x += across * exp(-across * across * 0.3) * aura * moving * 520.0 * uFigureForce * uDt;
    // Eddies curl around the legs: gently while standing, hard while walking.
    vec2 r = vec2((vUv.x - figure.x) * uAspect, vUv.y - figure.y);
    float swirl = sin(uTime * 0.45 + float(i) * 2.3) * 0.6 + 0.4 * sign(mod(float(i), 2.0) - 0.5);
    float eddy = uLayer > 0.5 ? 140.0 * moving : 90.0 + 380.0 * moving;
    velocity += vec2(-r.y, r.x) / (length(r) + 0.02) * feet * swirl * eddy * uFigureForce * uDt;
  }
  outColor = vec4(velocity, 0.0, 1.0);
}
`;

const divergenceShader = `${header}
uniform sampler2D uVelocity;
void main() {
  vec2 c = texture(uVelocity, vUv).xy;
  float l = texture(uVelocity, vL).x;
  float r = texture(uVelocity, vR).x;
  float t = texture(uVelocity, vT).y;
  float b = texture(uVelocity, vB).y;
  if (vL.x < 0.0) l = -c.x;
  if (vR.x > 1.0) r = -c.x;
  if (vT.y > 1.0) t = -c.y;
  if (vB.y < 0.0) b = -c.y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

const clearShader = `${header}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  outColor = uValue * texture(uSource, vUv);
}
`;

const pressureShader = `${header}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + b + t - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const gradientShader = `${header}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(r - l, t - b);
  outColor = vec4(velocity, 0.0, 1.0);
}
`;

const advectShader = `${header}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uVelocityTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uVelocityTexel;
  outColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}
`;

/*
 * The resting fog: where nothing disturbs it, density drifts back toward this
 * field: thicker toward the bottom of the window and along the stage floor.
 */
const restShader = `${header}
uniform sampler2D uDensity;
uniform float uTime;
uniform float uAspect;
uniform float uRefill;
uniform float uFloor;
uniform vec2 uPointer;
uniform float uWipe;
uniform float uRadius;
uniform vec4 uFigures[${String(MAX_FIGURES)}];
uniform vec2 uFigureVelocity[${String(MAX_FIGURES)}];
uniform int uFigureCount;
uniform float uStage;
uniform float uDt;
uniform float uLayer;
uniform vec4 uTroop;
uniform float uDepth;
${noise}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 2.1;
  vec2 warp = vec2(fbm(p + vec2(uTime * 0.02, 0.0)), fbm(p + vec2(3.1, -uTime * 0.015)));
  float body = fbm(p * 1.4 + warp * 1.6 + vec2(uTime * 0.025, 0.0));
  float bottom = smoothstep(0.65, 0.0, vUv.y);
  float floorBand = exp(-square((vUv.y - uFloor) / 0.12));
  float rest = smoothstep(0.24, 0.8, body) * (0.55 + bottom * 0.45 + floorBand * 0.7 * uStage)
    + 0.26 + bottom * 0.14 + floorBand * 0.12 * uStage;
  if (uLayer > 0.5) {
    // Front layer: only a thin, torn haze rests on the ground around the
    // troop. Everything above it is fog the feet stir up (below), so it shows
    // as plumes and wisps instead of a flat sheet.
    float troopHeight = max(uTroop.w - uTroop.y, 0.05);
    float h = (vUv.y - uTroop.y) / troopHeight;
    float spread = troopHeight * 0.5 / uAspect;
    float span = smoothstep(uTroop.x - spread, uTroop.x + spread * 0.3, vUv.x)
      * (1.0 - smoothstep(uTroop.z - spread * 0.3, uTroop.z + spread, vUv.x));
    float torn = smoothstep(0.42, 0.78, body);
    float ground = smoothstep(-0.25, 0.0, h) * (1.0 - smoothstep(0.04, 0.3 * uDepth, h));
    rest = torn * ground * span * 1.0;
  }
  float density = mix(texture(uDensity, vUv).x, clamp(rest, 0.0, 1.6), uRefill);
  if (uLayer > 0.5) {
    // Feet breathe fog out in separate puffs, more with every step, and legs
    // walking through it shed trails that rise and curl away.
    for (int i = 0; i < ${String(MAX_FIGURES)}; i++) {
      if (i >= uFigureCount) break;
      vec4 figure = uFigures[i];
      float height = max(figure.z - figure.y, 0.001);
      float up = (vUv.y - figure.y) / height;
      float across = (vUv.x - figure.x) / max(figure.w * 0.9, 0.001);
      float moving = clamp(length(uFigureVelocity[i]) / 15.0, 0.0, 1.0);
      float puffs = smoothstep(0.4, 0.8, noise(vec2(uTime * 0.8 + float(i) * 7.1, across * 1.4)));
      float feet = exp(-across * across) * exp(-square((up - 0.02) / 0.1));
      float legs = exp(-across * across * 1.6) * smoothstep(0.0, 0.1, up)
        * (1.0 - smoothstep(0.1 + 0.12 * uDepth, 0.2 + 0.2 * uDepth, up));
      density += (feet * (0.5 * puffs + 1.6 * moving) + legs * moving * (0.3 + body) * 0.5)
        * uStage * uDt;
    }
  }
  // Walking feet kick fog up.
  for (int i = 0; i < ${String(MAX_FIGURES)}; i++) {
    if (i >= uFigureCount || uLayer > 0.5) break;
    vec4 figure = uFigures[i];
    float height = max(figure.z - figure.y, 0.001);
    float up = (vUv.y - figure.y) / height;
    float across = (vUv.x - figure.x) / max(figure.w * 2.0, 0.001);
    float moving = clamp(length(uFigureVelocity[i]) / 15.0, 0.0, 1.0);
    density += exp(-across * across) * exp(-square(up / 0.16)) * moving * 4.5 * uStage * uDt;
  }
  vec2 d = vUv - uPointer;
  d.x *= uAspect;
  density *= 1.0 - uWipe * exp(-dot(d, d) / (uRadius * 1.6));
  outColor = vec4(max(density, 0.0), 0.0, 0.0, 1.0);
}
`;

/* Light the density field: a cold source above the stage, the lantern, and shading from the gradient. */
const displayShader = `${header}
uniform sampler2D uDensity;
uniform vec2 uViewport;
uniform float uScroll;
uniform float uTime;
uniform vec2 uLamp;
uniform float uLampRadius;
uniform float uFlicker;
uniform vec3 uFog;
uniform vec3 uLight;
uniform vec4 uTroop;
uniform float uBehind;
uniform float uLayer;
uniform vec4 uRegion;
uniform float uOpacity;
${noise}
void main() {
  float density = texture(uDensity, vUv).x;
  float dx = texture(uDensity, vR).x - texture(uDensity, vL).x;
  float dy = texture(uDensity, vT).x - texture(uDensity, vB).x;

  vec2 view = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  vec2 sky = vec2(uViewport.x * 0.5, 120.0) - vec2(0.0, uScroll * 0.6);
  vec2 toSky = view - sky;
  float skyDistance = length(toSky);
  float skyGlow = exp(-skyDistance / 380.0);
  float angle = atan(toSky.y, toSky.x);
  float rays = pow(noise(vec2(angle * 18.0, uTime * 0.05)), 3.0)
    * noise(vec2(angle * 6.0, -uTime * 0.04))
    * exp(-skyDistance / 780.0)
    * smoothstep(-40.0, 140.0, toSky.y);

  vec2 toLamp = view - uLamp;
  float lamp = exp(-square(length(toLamp) / uLampRadius)) * uFlicker;

  // Matte fog: light scatters inside it and thick fog swallows it, so dense
  // parts go darker and greyer instead of catching highlights. A faint
  // self-shadow from the density slope keeps the volume readable.
  float body = smoothstep(0.0, 1.25, density);
  float slope = clamp((dy - abs(dx) * 0.3) * 4.0, -1.0, 1.0);
  float absorb = mix(1.0, 0.62, body);
  vec3 colour = uFog * (0.26 + skyGlow * 0.95 + lamp * 0.42 + rays * 0.55)
    * absorb * (1.0 + slope * 0.06);
  colour = min(colour, vec3(0.62, 0.68, 0.7));
  float alpha = body * 0.9 + (rays * 0.35 + skyGlow * 0.12) * (1.0 - body) + lamp * 0.06;
  if (uLayer > 0.5) {
    // In front of the bodies thin fog must stay readable and thick fog
    // translucent, or plumes merge into one grey sheet. Torn edges catch a
    // little of the light, without any shine.
    float thin = smoothstep(0.02, 0.6, density);
    float edge = clamp(length(vec2(dx, dy)) * 5.0, 0.0, 1.0);
    colour = min(
      uFog * (0.34 + skyGlow * 0.8 + lamp * 0.35) * (1.0 + edge * 0.12),
      vec3(0.66, 0.72, 0.74)
    );
    alpha = thin * (0.5 + 0.32 * smoothstep(0.6, 1.4, density));
  }
  vec2 centred = vUv - 0.5;
  alpha *= 0.78 + 0.22 * smoothstep(0.75, 0.2, length(centred * vec2(1.0, 1.2)));
  // Behind the troop the front fog takes over; fade this one out softly so
  // the two do not pile up into mush.
  float troop = smoothstep(uTroop.x - 0.09, uTroop.x + 0.03, vUv.x)
    * (1.0 - smoothstep(uTroop.z - 0.03, uTroop.z + 0.09, vUv.x))
    * smoothstep(uTroop.y - 0.12, uTroop.y + 0.02, vUv.y)
    * (1.0 - smoothstep(uTroop.w - 0.02, uTroop.w + 0.14, vUv.y));
  alpha *= mix(1.0, uBehind, troop);
  if (uLayer > 0.5) {
    float inside = step(uRegion.x, view.x) * step(view.x, uRegion.z)
      * step(uRegion.y, view.y) * step(view.y, uRegion.w);
    alpha *= inside * uOpacity;
  }
  outColor = vec4(mix(colour, uLight, rays * 0.25), clamp(alpha, 0.0, 0.94));
}
`;

interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

interface DoubleTarget {
  read: Target;
  write: Target;
  readonly texel: readonly [number, number];
}

interface Program {
  readonly program: WebGLProgram;
  readonly uniform: (name: string) => WebGLUniformLocation | null;
}

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader did not compile.");
  }
  return shader;
};

/**
 * Runs the fog fluid in a WebGL 2 context that can render to half-float
 * textures. Returns a stop function. Throws when the context cannot.
 */
export const startFluidFog = (
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  options: FluidFogOptions,
): (() => void) => {
  const output = canvas;
  const veilLayer = options.layer === "veil";
  // The veil only covers the stage: a coarser grid looks the same there.
  const simWidth = veilLayer ? 128 : SIM_WIDTH;
  const dyeWidth = veilLayer ? 320 : DYE_WIDTH;
  const pressureIterations = veilLayer ? 12 : PRESSURE_ITERATIONS;
  let regionRect: DOMRect | null = null;
  let asleep = false;
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("Half-float render targets are unavailable.");
  }

  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const shaders: WebGLShader[] = [vertex];
  const programs: WebGLProgram[] = [];
  const build = (source: string): Program => {
    const fragment = compile(gl, gl.FRAGMENT_SHADER, source);
    shaders.push(fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Program did not link.");
    }
    programs.push(program);
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      program,
      uniform: (name) => {
        if (!cache.has(name))
          cache.set(name, gl.getUniformLocation(program, name));
        return cache.get(name) ?? null;
      },
    };
  };

  const curl = build(curlShader);
  const vorticity = build(vorticityShader);
  const force = build(forceShader);
  const divergence = build(divergenceShader);
  const clear = build(clearShader);
  const pressure = build(pressureShader);
  const gradient = build(gradientShader);
  const advect = build(advectShader);
  const rest = build(restShader);
  const display = build(displayShader);

  const vao = gl.createVertexArray();
  const quad = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const target = (width: number, height: number): Target => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      width,
      height,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null,
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    textures.push(texture);
    framebuffers.push(framebuffer);
    return { texture, framebuffer, width, height };
  };
  const double = (width: number, height: number): DoubleTarget => ({
    read: target(width, height),
    write: target(width, height),
    texel: [1 / width, 1 / height],
  });
  const swap = (pair: DoubleTarget) => {
    const read = pair.read;
    pair.read = pair.write;
    pair.write = read;
  };

  const viewport = { width: 1, height: 1 };
  let velocity!: DoubleTarget;
  let density!: DoubleTarget;
  let pressureField!: DoubleTarget;
  let curlField!: Target;
  let divergenceField!: Target;
  let primed = false;

  const freeTargets = () => {
    for (const texture of textures.splice(0)) gl.deleteTexture(texture);
    for (const fb of framebuffers.splice(0)) gl.deleteFramebuffer(fb);
  };

  const resize = () => {
    viewport.width = canvas.clientWidth || globalThis.innerWidth;
    viewport.height = canvas.clientHeight || globalThis.innerHeight;
    output.width = Math.max(1, Math.round(viewport.width * options.resolution));
    output.height = Math.max(
      1,
      Math.round(viewport.height * options.resolution),
    );
    const aspect = viewport.height / viewport.width;
    const simHeight = Math.max(32, Math.round(simWidth * aspect));
    const dyeHeight = Math.max(64, Math.round(dyeWidth * aspect));
    freeTargets();
    velocity = double(simWidth, simHeight);
    pressureField = double(simWidth, simHeight);
    curlField = target(simWidth, simHeight);
    divergenceField = target(simWidth, simHeight);
    density = double(dyeWidth, dyeHeight);
    primed = false;
  };

  let unit = 0;
  const use = (program: Program, texel: readonly [number, number]) => {
    gl.useProgram(program.program);
    gl.uniform2f(program.uniform("uTexel"), texel[0], texel[1]);
    unit = 0;
  };
  const sampler = (program: Program, name: string, texture: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uniform(name), unit);
    unit += 1;
  };
  const draw = (destination: Target | null) => {
    if (destination) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
      gl.viewport(0, 0, destination.width, destination.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, output.width, output.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const tuning = readFogTuning();
  const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, on: false, moved: false };
  const figureData = new Float32Array(MAX_FIGURES * 4);
  const figureVelocity = new Float32Array(MAX_FIGURES * 2);
  const tracker = new FigureMotionTracker();
  let figureCount = 0;
  /** Where the troop stands, in uv (y up): left, bottom, right, top. Off screen when nobody does. */
  const troop = { x0: 2, y0: 2, x1: 2, y1: 2, ready: false };

  /** Where the characters stand (uv, y up) and how fast they move (grid cells per second). */
  const readFigures = (dt: number) => {
    const now = performance.now();
    const simHeight = 1 / velocity.texel[1];
    const tracked = tracker.update(
      readFogFigures(now).slice(0, MAX_FIGURES),
      now,
      Math.min(dt, 1 / 20),
    );
    figureCount = 0;
    for (const { figure, vx, vy } of tracked) {
      const x = figure.x / viewport.width;
      const feet = 1 - figure.feet / viewport.height;
      const head = 1 - figure.head / viewport.height;
      const halfWidth = figure.halfWidth / viewport.width;
      if (
        x + halfWidth * 3 < 0 ||
        x - halfWidth * 3 > 1 ||
        head < -0.1 ||
        feet > 1.1
      ) {
        continue;
      }
      const i = figureCount;
      figureData.set([x, feet, head, halfWidth], i * 4);
      // px/s on screen (y down) to grid cells per second (y up).
      figureVelocity.set(
        [(vx / viewport.width) * simWidth, (-vy / viewport.height) * simHeight],
        i * 2,
      );
      figureCount += 1;
    }
    // Where the troop will stand, so the front fog is already there when the
    // characters walk in: wide across the stage, between its floor and head height.
    const box = regionRect ?? {
      top: 0,
      bottom: viewport.height,
    };
    const boxHeight = Math.max(box.bottom - box.top, 1);
    const place = {
      x0: 0.06,
      x1: 0.94,
      y0: 1 - (box.top + boxHeight * 0.84) / viewport.height,
      y1: 1 - (box.top + boxHeight * 0.16) / viewport.height,
    };
    if (figureCount === 0) {
      if (veilLayer) {
        if (!troop.ready) Object.assign(troop, { ...place, ready: true });
        const ease = 1 - Math.exp(-Math.min(dt, 1 / 20) / 0.5);
        troop.x0 += (place.x0 - troop.x0) * ease;
        troop.y0 += (place.y0 - troop.y0) * ease;
        troop.x1 += (place.x1 - troop.x1) * ease;
        troop.y1 += (place.y1 - troop.y1) * ease;
      } else {
        troop.ready = false;
        troop.x0 = troop.y0 = troop.x1 = troop.y1 = 2;
      }
      return;
    }
    let x0 = veilLayer ? Math.min(1, place.x0) : 1;
    let y0 = 1;
    let x1 = veilLayer ? Math.max(0, place.x1) : 0;
    let y1 = 0;
    for (let i = 0; i < figureCount; i += 1) {
      const x = figureData[i * 4] ?? 0;
      const feet = figureData[i * 4 + 1] ?? 0;
      const head = figureData[i * 4 + 2] ?? 0;
      const halfWidth = figureData[i * 4 + 3] ?? 0;
      x0 = Math.min(x0, x - halfWidth);
      x1 = Math.max(x1, x + halfWidth);
      y0 = Math.min(y0, feet);
      y1 = Math.max(y1, head);
    }
    if (!troop.ready) {
      Object.assign(troop, { x0, y0, x1, y1, ready: true });
    }
    const settle = 1 - Math.exp(-Math.min(dt, 1 / 20) / 0.5);
    troop.x0 += (x0 - troop.x0) * settle;
    troop.y0 += (y0 - troop.y0) * settle;
    troop.x1 += (x1 - troop.x1) * settle;
    troop.y1 += (y1 - troop.y1) * settle;
  };

  const lamp = { x: 0, y: 0, ready: false };
  let scrollY = globalThis.scrollY;
  let scrollPush = 0;
  let flicker = 1;
  let frame = 0;
  let last = performance.now();

  const onPointerMove = (event: PointerEvent) => {
    const x = event.clientX / viewport.width;
    const y = 1 - event.clientY / viewport.height;
    if (pointer.on) {
      pointer.dx += x - pointer.x;
      pointer.dy += y - pointer.y;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.on = true;
    pointer.moved = true;
  };
  const onPointerLeave = () => {
    pointer.on = false;
  };

  const step = (dt: number, time: number) => {
    readFigures(dt);
    const aspect = viewport.width / viewport.height;
    const floor =
      1 - (viewport.height * 0.86 - globalThis.scrollY) / viewport.height;

    gl.disable(gl.BLEND);

    use(curl, velocity.texel);
    sampler(curl, "uVelocity", velocity.read.texture);
    draw(curlField);

    use(vorticity, velocity.texel);
    sampler(vorticity, "uVelocity", velocity.read.texture);
    sampler(vorticity, "uCurl", curlField.texture);
    gl.uniform1f(
      vorticity.uniform("uCurlStrength"),
      veilLayer ? CURL * 0.4 : CURL,
    );
    gl.uniform1f(vorticity.uniform("uDt"), dt);
    draw(velocity.write);
    swap(velocity);

    const moved = pointer.moved && pointer.on;
    use(force, velocity.texel);
    sampler(force, "uVelocity", velocity.read.texture);
    gl.uniform1f(force.uniform("uTime"), time);
    gl.uniform1f(force.uniform("uAspect"), aspect);
    gl.uniform1f(force.uniform("uDt"), dt);
    gl.uniform2f(force.uniform("uPointer"), pointer.x, pointer.y);
    gl.uniform2f(
      force.uniform("uPush"),
      moved ? pointer.dx * SPLAT_FORCE * tuning.mouse : 0,
      moved ? pointer.dy * SPLAT_FORCE * tuning.mouse : 0,
    );
    gl.uniform1f(force.uniform("uRadius"), SPLAT_RADIUS);
    gl.uniform1f(force.uniform("uScrollPush"), scrollPush);
    gl.uniform4fv(force.uniform("uFigures"), figureData);
    gl.uniform2fv(force.uniform("uFigureVelocity"), figureVelocity);
    gl.uniform1i(force.uniform("uFigureCount"), figureCount);
    gl.uniform1f(force.uniform("uFigureForce"), tuning.figures);
    gl.uniform1f(force.uniform("uLayer"), veilLayer ? 1 : 0);
    draw(velocity.write);
    swap(velocity);

    use(divergence, velocity.texel);
    sampler(divergence, "uVelocity", velocity.read.texture);
    draw(divergenceField);

    use(clear, velocity.texel);
    sampler(clear, "uSource", pressureField.read.texture);
    gl.uniform1f(clear.uniform("uValue"), 0.8);
    draw(pressureField.write);
    swap(pressureField);

    use(pressure, velocity.texel);
    for (let i = 0; i < pressureIterations; i += 1) {
      unit = 0;
      sampler(pressure, "uDivergence", divergenceField.texture);
      sampler(pressure, "uPressure", pressureField.read.texture);
      draw(pressureField.write);
      swap(pressureField);
    }

    use(gradient, velocity.texel);
    sampler(gradient, "uPressure", pressureField.read.texture);
    sampler(gradient, "uVelocity", velocity.read.texture);
    draw(velocity.write);
    swap(velocity);

    use(advect, velocity.texel);
    sampler(advect, "uVelocity", velocity.read.texture);
    sampler(advect, "uSource", velocity.read.texture);
    gl.uniform2f(
      advect.uniform("uVelocityTexel"),
      velocity.texel[0],
      velocity.texel[1],
    );
    gl.uniform1f(advect.uniform("uDt"), dt);
    // In front, motion settles quickly: fog drifts, it does not whirl.
    gl.uniform1f(
      advect.uniform("uDissipation"),
      veilLayer ? VELOCITY_DISSIPATION * 1.2 : VELOCITY_DISSIPATION,
    );
    draw(velocity.write);
    swap(velocity);

    use(advect, density.texel);
    sampler(advect, "uVelocity", velocity.read.texture);
    sampler(advect, "uSource", density.read.texture);
    gl.uniform2f(
      advect.uniform("uVelocityTexel"),
      velocity.texel[0],
      velocity.texel[1],
    );
    gl.uniform1f(advect.uniform("uDt"), dt);
    gl.uniform1f(advect.uniform("uDissipation"), 0);
    draw(density.write);
    swap(density);

    use(rest, density.texel);
    sampler(rest, "uDensity", density.read.texture);
    gl.uniform1f(rest.uniform("uTime"), time);
    gl.uniform1f(rest.uniform("uAspect"), aspect);
    // In front, stirred fog fades slowly, so plumes drift a while before they go.
    gl.uniform1f(
      rest.uniform("uRefill"),
      primed ? (veilLayer ? REFILL * 0.6 : REFILL) * dt : 1,
    );
    gl.uniform1f(rest.uniform("uFloor"), floor);
    gl.uniform2f(rest.uniform("uPointer"), pointer.x, pointer.y);
    const speed = Math.hypot(pointer.dx, pointer.dy);
    gl.uniform1f(
      rest.uniform("uWipe"),
      moved
        ? Math.min(0.5, WIPE * tuning.mouse * dt * Math.min(1, speed * 60))
        : 0,
    );
    gl.uniform1f(rest.uniform("uRadius"), SPLAT_RADIUS);
    gl.uniform4fv(rest.uniform("uFigures"), figureData);
    gl.uniform1i(rest.uniform("uFigureCount"), figureCount);
    gl.uniform1f(rest.uniform("uStage"), tuning.stage);
    gl.uniform1f(rest.uniform("uLayer"), veilLayer ? 1 : 0);
    gl.uniform4f(
      rest.uniform("uTroop"),
      troop.x0,
      troop.y0,
      troop.x1,
      troop.y1,
    );
    gl.uniform1f(rest.uniform("uDepth"), options.depth ?? 1);
    gl.uniform2fv(rest.uniform("uFigureVelocity"), figureVelocity);
    gl.uniform1f(rest.uniform("uDt"), dt);
    draw(density.write);
    swap(density);
    primed = true;

    pointer.dx = 0;
    pointer.dy = 0;
    pointer.moved = false;
    scrollPush = 0;
  };

  const render = (now: number) => {
    const aim = pointer.on
      ? {
          x: pointer.x * viewport.width,
          y: (1 - pointer.y) * viewport.height,
        }
      : {
          x: viewport.width * (0.5 + 0.22 * Math.sin(now * 0.00023)),
          y: viewport.height * (0.5 + 0.14 * Math.cos(now * 0.00031)),
        };
    if (!lamp.ready) {
      lamp.x = aim.x;
      lamp.y = aim.y;
      lamp.ready = true;
    }
    lamp.x += (aim.x - lamp.x) * 0.055;
    lamp.y += (aim.y - lamp.y) * 0.055;
    if (!options.reducedMotion && Math.random() < 0.004) {
      flicker = 0.45 + Math.random() * 0.3;
    }
    flicker += (1 - flicker) * 0.06;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    use(display, density.texel);
    sampler(display, "uDensity", density.read.texture);
    gl.uniform2f(display.uniform("uViewport"), viewport.width, viewport.height);
    gl.uniform1f(display.uniform("uScroll"), globalThis.scrollY);
    gl.uniform1f(display.uniform("uTime"), now / 1000);
    gl.uniform2f(display.uniform("uLamp"), lamp.x, lamp.y);
    gl.uniform1f(display.uniform("uLampRadius"), 440);
    gl.uniform1f(display.uniform("uFlicker"), flicker);
    gl.uniform3f(display.uniform("uFog"), 0.62, 0.7, 0.74);
    gl.uniform3f(display.uniform("uLight"), 0.7, 0.86, 0.9);
    gl.uniform4f(
      display.uniform("uTroop"),
      troop.x0,
      troop.y0,
      troop.x1,
      troop.y1,
    );
    gl.uniform1f(
      display.uniform("uBehind"),
      veilLayer ? 1 : Math.min(1, tuning.behind),
    );
    gl.uniform1f(display.uniform("uLayer"), veilLayer ? 1 : 0);
    gl.uniform1f(display.uniform("uOpacity"), options.opacity ?? 1);
    if (regionRect) {
      gl.uniform4f(
        display.uniform("uRegion"),
        regionRect.left,
        regionRect.top,
        regionRect.right,
        regionRect.bottom,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.clearColor(0, 0, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (veilLayer) {
      regionRect = options.region?.() ?? null;
      if (
        !regionRect ||
        regionRect.bottom < 0 ||
        regionRect.top > viewport.height
      ) {
        if (!asleep) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, output.width, output.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          asleep = true;
        }
        last = now;
        return;
      }
      asleep = false;
    }
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const scroll = globalThis.scrollY;
    // Content moving up drags the fog with it a little.
    scrollPush += (scroll - scrollY) * 0.9;
    scrollY = scroll;
    step(dt, now / 1000);
    render(now);
  };

  resize();
  globalThis.addEventListener("resize", resize);
  globalThis.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    globalThis.removeEventListener("resize", resize);
    globalThis.removeEventListener("pointermove", onPointerMove);
    document.documentElement.removeEventListener(
      "pointerleave",
      onPointerLeave,
    );
    freeTargets();
    for (const program of programs) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    gl.deleteBuffer(quad);
    gl.deleteVertexArray(vao);
  };
};
