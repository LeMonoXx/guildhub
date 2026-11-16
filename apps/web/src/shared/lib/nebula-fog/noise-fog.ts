/*
 * The light fallback: one full-screen fragment shader of drifting noise, lit
 * like the fluid, with no simulation. This module is only the glue: compile,
 * upload uniforms, draw.
 */

import { compileShader, linkProgram } from "./gl-program";
import { fragmentShader, vertexShader } from "./noise-fog-shaders";

export interface NoiseFogOptions {
  /** Draw a single still frame and never animate. */
  readonly reducedMotion: boolean;
  /** Canvas pixels per CSS pixel. */
  readonly resolution: number;
}

const FRAME_MS = 1000 / 30;

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

export const startNoiseFog = (
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  options: NoiseFogOptions,
): (() => void) => {
  const { resolution } = options;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = linkProgram(gl, vertex, fragment);
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
    canvas.width = Math.max(1, Math.round(viewport.width * resolution));
    canvas.height = Math.max(1, Math.round(viewport.height * resolution));
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
