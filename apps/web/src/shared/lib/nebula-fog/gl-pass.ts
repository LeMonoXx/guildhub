import type { Program } from "./gl-program";
import type { Target } from "./gl-targets";

export interface PassRunner {
  /** Activates a program and restarts texture unit assignment. */
  readonly use: (program: Program, texel: readonly [number, number]) => void;
  /** Binds `texture` to the next free texture unit. */
  readonly sampler: (
    program: Program,
    name: string,
    texture: WebGLTexture,
  ) => void;
  /** Restarts texture unit assignment without switching programs. */
  readonly rewind: () => void;
  /** Draws the full-screen triangle into `destination`. */
  readonly draw: (destination: Target) => void;
}

export const createPassRunner = (gl: WebGL2RenderingContext): PassRunner => {
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
  const rewind = () => {
    unit = 0;
  };
  const draw = (destination: Target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  return { use, sampler, rewind, draw };
};

/** One triangle that covers the whole viewport, bound to attribute 0. Returns its disposer. */
export const createFullScreenTriangle = (
  gl: WebGL2RenderingContext,
): (() => void) => {
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
  return () => {
    gl.deleteBuffer(quad);
    gl.deleteVertexArray(vao);
  };
};
