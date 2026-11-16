export const vertexShader = /* glsl */ `
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
export const fragmentShader = /* glsl */ `
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
