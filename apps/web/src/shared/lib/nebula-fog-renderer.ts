/*
 * The page-wide fog is one full-screen fragment shader. It uses the browser's
 * WebGL API directly because Three.js is confined to the character rendering
 * adapters (see .dependency-cruiser.cjs, web-three-adapter-boundary) and a
 * single textured-less quad needs none of its scene graph. This file is only
 * the glue: compile, upload uniforms, draw.
 */

import { startFluidFog } from "./nebula-fog-fluid";

export interface NebulaFogOptions {
  /** Draw a single still frame and never animate. */
  readonly reducedMotion: boolean;
}

/** Fog is soft by nature: half resolution looks the same and costs a quarter. */
const RESOLUTION = 0.5;
const FRAME_MS = 1000 / 30;

const vertexShader = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
 * Domain-warped value noise lit by a cold light above the stage and by a
 * lantern that follows the pointer. The pointer also parts the fog. Output is
 * straight alpha so the page shows through where the fog is thin.
 */
const fragmentShader = /* glsl */ `
precision highp float;
uniform vec2 uViewport;
uniform float uScroll;
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uVelocity;
uniform float uPointerOn;
uniform vec2 uLamp;
uniform float uLampRadius;
uniform float uFlicker;
uniform float uFloor;
uniform vec3 uFog;
uniform vec3 uLight;
varying vec2 vUv;

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

void main() {
  // Viewport pixels, y down; page pixels add the scroll offset.
  vec2 view = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  vec2 page = view + vec2(0.0, uScroll);

  vec2 sky = vec2(uViewport.x * 0.5, 120.0) - vec2(0.0, uScroll * 0.6);
  vec2 toSky = view - sky;
  float skyDistance = length(toSky);
  float skyGlow = exp(-skyDistance / 360.0);
  float angle = atan(toSky.y, toSky.x);
  float rays = pow(noise(vec2(angle * 18.0, uTime * 0.05)), 3.0)
    * noise(vec2(angle * 6.0, -uTime * 0.04))
    * exp(-skyDistance / 760.0)
    * smoothstep(-40.0, 140.0, toSky.y);

  vec2 drift = vec2(page.x, page.y - uScroll * 0.35);
  vec2 away = view - uPointer;
  float touch = exp(-dot(away, away) / (230.0 * 230.0)) * uPointerOn;
  drift += normalize(away + 0.001) * touch * 80.0 - uVelocity * touch * 3.0;

  vec2 q = drift / 440.0;
  float t = uTime * 0.03;
  vec2 warp = vec2(fbm(q * 1.3 + vec2(t, 0.0)), fbm(q * 1.3 + vec2(3.1, -t * 0.7)));
  float body = fbm(q * 1.9 + 1.8 * warp + vec2(t * 1.3, 0.0));
  float low = fbm(vec2(q.x * 1.1 - t * 2.6, q.y * 3.4) + warp * 0.6);

  float floorBand = exp(-square((page.y - uFloor) / 190.0));
  float viewFloor = smoothstep(0.55, 1.0, view.y / uViewport.y);
  float amount = smoothstep(0.32, 0.92, body) * (0.6 + floorBand * 0.8 + viewFloor * 0.3)
    + smoothstep(0.40, 0.86, low) * (floorBand * 0.95 + viewFloor * 0.35);
  amount = clamp(amount, 0.0, 1.0);

  float lamp = exp(-square(length(view - uLamp) / uLampRadius)) * uFlicker;
  vec3 colour = uFog * (0.22 + skyGlow * 1.5 + lamp * 1.2 + rays * 0.9);
  float alpha = amount * 0.86 + (rays * 0.35 + skyGlow * 0.12) * (1.0 - amount) + lamp * 0.05;

  // Soft vignette toward the window edges.
  vec2 centred = vUv - 0.5;
  alpha *= 0.7 + 0.3 * smoothstep(0.75, 0.2, length(centred * vec2(1.0, 1.2)));

  gl_FragColor = vec4(mix(colour, uLight, rays * 0.25), clamp(alpha, 0.0, 0.92));
}
`;

const compile = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
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

const uniformNames = [
  "uViewport",
  "uScroll",
  "uTime",
  "uPointer",
  "uVelocity",
  "uPointerOn",
  "uLamp",
  "uLampRadius",
  "uFlicker",
  "uFloor",
  "uFog",
  "uLight",
] as const;

/**
 * Renders the page-wide fog into `canvas` until the returned stop function is
 * called. Pauses itself while the tab is hidden (requestAnimationFrame does).
 * Throws when WebGL is unavailable; callers treat that as "no fog".
 */
const contextAttributes: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  powerPreference: "low-power",
};

/**
 * Starts the page fog. Capable browsers get the fluid simulation (the pointer
 * pushes and stirs real fog); reduced motion, or a context without half-float
 * render targets, gets the still or drifting noise fog below.
 */
export const startNebulaFog = (
  canvas: HTMLCanvasElement,
  options: NebulaFogOptions,
): (() => void) => {
  const gl2 = canvas.getContext("webgl2", contextAttributes);
  if (gl2 && !options.reducedMotion) {
    try {
      return startFluidFog(canvas, gl2, { ...options, resolution: RESOLUTION });
    } catch {
      // Fall through to the noise fog in the same context.
    }
  }
  const gl = gl2 ?? canvas.getContext("webgl", contextAttributes);
  if (!gl) throw new Error("WebGL is unavailable.");
  return startNoiseFog(canvas, gl, options);
};

/** The light fallback: drifting noise lit like the fluid, no simulation. */
const startNoiseFog = (
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  options: NebulaFogOptions,
): (() => void) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program did not link.");
  }
  gl.useProgram(program);

  // One triangle that covers the whole viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const uniform = Object.fromEntries(
    uniformNames.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;
  gl.uniform3f(uniform.uFog, 0.62, 0.7, 0.74);
  gl.uniform3f(uniform.uLight, 0.7, 0.86, 0.9);
  gl.uniform1f(uniform.uLampRadius, 300);

  const viewport = { width: 1, height: 1 };
  const pointer = { x: -9999, y: -9999, on: false };
  const previous = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  const lamp = { x: 0, y: 0, ready: false };
  let pointerOn = 0;
  let flicker = 1;
  let frame = 0;
  let last = 0;

  const resize = () => {
    viewport.width = canvas.clientWidth || globalThis.innerWidth;
    viewport.height = canvas.clientHeight || globalThis.innerHeight;
    canvas.width = Math.max(1, Math.round(viewport.width * RESOLUTION));
    canvas.height = Math.max(1, Math.round(viewport.height * RESOLUTION));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniform.uViewport, viewport.width, viewport.height);
    gl.uniform1f(uniform.uFloor, viewport.height * 0.86);
  };

  const onPointerMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.on = true;
  };
  const onPointerLeave = () => {
    pointer.on = false;
  };

  const draw = (now: number) => {
    const target = pointer.on
      ? { x: pointer.x, y: pointer.y }
      : {
          x: viewport.width * (0.5 + 0.22 * Math.sin(now * 0.00023)),
          y: viewport.height * (0.5 + 0.14 * Math.cos(now * 0.00031)),
        };
    if (!lamp.ready) {
      lamp.x = target.x;
      lamp.y = target.y;
      lamp.ready = true;
    }
    lamp.x += (target.x - lamp.x) * 0.055;
    lamp.y += (target.y - lamp.y) * 0.055;

    pointerOn += ((pointer.on ? 1 : 0) - pointerOn) * 0.08;
    velocity.x = velocity.x * 0.8 + (pointer.x - previous.x) * 0.2;
    velocity.y = velocity.y * 0.8 + (pointer.y - previous.y) * 0.2;
    previous.x = pointer.x;
    previous.y = pointer.y;

    // A lantern that now and then gutters.
    if (!options.reducedMotion && Math.random() < 0.006) {
      flicker = 0.45 + Math.random() * 0.3;
    }
    flicker += (1 - flicker) * 0.07;

    gl.uniform1f(uniform.uTime, options.reducedMotion ? 20 : now / 1000);
    gl.uniform1f(uniform.uScroll, globalThis.scrollY);
    gl.uniform2f(uniform.uLamp, lamp.x, lamp.y);
    gl.uniform2f(uniform.uPointer, pointer.x, pointer.y);
    gl.uniform2f(uniform.uVelocity, velocity.x, velocity.y);
    gl.uniform1f(uniform.uPointerOn, pointerOn);
    gl.uniform1f(uniform.uFlicker, flicker);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
  };

  const onScroll = () => {
    draw(performance.now());
  };

  resize();
  globalThis.addEventListener("resize", resize);
  if (options.reducedMotion) {
    draw(0);
    globalThis.addEventListener("scroll", onScroll, { passive: true });
  } else {
    globalThis.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(loop);
  }

  return () => {
    cancelAnimationFrame(frame);
    globalThis.removeEventListener("resize", resize);
    globalThis.removeEventListener("scroll", onScroll);
    globalThis.removeEventListener("pointermove", onPointerMove);
    document.documentElement.removeEventListener(
      "pointerleave",
      onPointerLeave,
    );
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };
};
