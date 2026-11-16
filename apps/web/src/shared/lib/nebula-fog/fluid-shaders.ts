/** Characters the solver follows at most (the lineup has six). */
export const MAX_FIGURES = 8;

export const vertexShader = /* glsl */ `#version 300 es
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

export const curlShader = `${header}
uniform sampler2D uVelocity;
void main() {
  float l = texture(uVelocity, vL).y;
  float r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x;
  float b = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
`;

export const vorticityShader = `${header}
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
export const forceShader = `${header}
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

export const divergenceShader = `${header}
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

export const clearShader = `${header}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  outColor = uValue * texture(uSource, vUv);
}
`;

export const pressureShader = `${header}
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

export const gradientShader = `${header}
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

export const advectShader = `${header}
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
export const restShader = `${header}
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
export const displayShader = `${header}
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
