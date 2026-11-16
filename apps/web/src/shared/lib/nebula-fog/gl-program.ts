export interface Program {
  readonly program: WebGLProgram;
  readonly uniform: (name: string) => WebGLUniformLocation | null;
}

export interface ProgramBuilder {
  readonly build: (fragmentSource: string) => Program;
  readonly dispose: () => void;
}

export const compileShader = (
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

/** Links two compiled shaders; `position` is bound to attribute location 0 when given. */
export const linkProgram = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vertex: WebGLShader,
  fragment: WebGLShader,
  position?: string,
): WebGLProgram => {
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  if (position) gl.bindAttribLocation(program, 0, position);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program did not link.");
  }
  return program;
};

/**
 * Builds fragment programs that all share one vertex shader, with cached
 * uniform locations. `dispose` deletes every program and shader it made.
 */
export const createProgramBuilder = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
): ProgramBuilder => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const shaders: WebGLShader[] = [vertex];
  const programs: WebGLProgram[] = [];
  const build = (source: string): Program => {
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, source);
    shaders.push(fragment);
    const program = linkProgram(gl, vertex, fragment, "aPos");
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
  const dispose = () => {
    for (const program of programs) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
  };
  return { build, dispose };
};
