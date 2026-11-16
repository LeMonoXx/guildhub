export interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

/** A ping-pong pair: passes read one half and write the other, then swap. */
export interface DoubleTarget {
  read: Target;
  write: Target;
  readonly texel: readonly [number, number];
}

export interface TargetPool {
  readonly target: (width: number, height: number) => Target;
  readonly double: (width: number, height: number) => DoubleTarget;
  /** Deletes every texture and framebuffer the pool has made so far. */
  readonly free: () => void;
}

export const swap = (pair: DoubleTarget) => {
  const read = pair.read;
  pair.read = pair.write;
  pair.write = read;
};

/** Half-float render targets, cleared to opaque black. */
export const createTargetPool = (gl: WebGL2RenderingContext): TargetPool => {
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
  const free = () => {
    for (const texture of textures.splice(0)) gl.deleteTexture(texture);
    for (const fb of framebuffers.splice(0)) gl.deleteFramebuffer(fb);
  };
  return { target, double, free };
};
