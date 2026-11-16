import * as THREE from "three";
import type {
  MaterialAnimationBinding,
  MaterialFrame,
} from "./material-bindings";

const SPIN_CENTER = new THREE.Vector2(0.5, 0.5);

interface TextureBase {
  offset: THREE.Vector2;
  repeat: THREE.Vector2;
  center: THREE.Vector2;
  rotation: number;
  matrix: THREE.Matrix3;
  matrixAutoUpdate: boolean;
}

/** The unanimated look of one binding; every frame is applied on top of it. */
export interface MaterialBaseState {
  readonly binding: MaterialAnimationBinding;
  readonly color: THREE.Color;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly texture?: TextureBase;
}

const validAlpha = (value: number): number =>
  Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1;

export function captureBase(
  binding: MaterialAnimationBinding,
): MaterialBaseState {
  const { material, texture } = binding;
  return {
    binding,
    color: material.color.clone(),
    opacity: material.opacity,
    transparent: material.transparent,
    texture: texture && {
      offset: texture.offset.clone(),
      repeat: texture.repeat.clone(),
      center: texture.center.clone(),
      rotation: texture.rotation,
      matrix: texture.matrix.clone(),
      matrixAutoUpdate: texture.matrixAutoUpdate,
    },
  };
}

function setTransparent(
  material: MaterialAnimationBinding["material"],
  transparent: boolean,
): void {
  if (material.transparent === transparent) return;
  material.transparent = transparent;
  material.needsUpdate = true;
}

export function applyFrame(
  state: MaterialBaseState,
  frame: MaterialFrame,
): void {
  const { material, texture } = state.binding;
  material.color
    .copy(state.color)
    .multiply(
      new THREE.Color(frame.rgb[0] ?? 1, frame.rgb[1] ?? 1, frame.rgb[2] ?? 1),
    );
  const opacity = THREE.MathUtils.clamp(
    state.opacity *
      validAlpha(frame.colorAlpha) *
      validAlpha(frame.transparencyAlpha),
    0,
    1,
  );
  material.opacity = opacity;
  setTransparent(material, state.transparent || opacity < 1);
  const base = state.texture;
  if (!texture || !base) return;
  texture.offset.set(
    base.offset.x + (frame.translation[0] ?? 0),
    base.offset.y + (frame.translation[1] ?? 0),
  );
  texture.repeat.set(
    base.repeat.x * (frame.scaling[0] ?? 1),
    base.repeat.y * (frame.scaling[1] ?? 1),
  );
  texture.center.copy(frame.rotation === undefined ? base.center : SPIN_CENTER);
  texture.rotation = base.rotation + (frame.rotation ?? 0);
  texture.updateMatrix();
}

export function restoreBase(state: MaterialBaseState): void {
  const { material, texture } = state.binding;
  material.color.copy(state.color);
  material.opacity = state.opacity;
  setTransparent(material, state.transparent);
  const base = state.texture;
  if (!texture || !base) return;
  texture.offset.copy(base.offset);
  texture.repeat.copy(base.repeat);
  texture.center.copy(base.center);
  texture.rotation = base.rotation;
  texture.matrixAutoUpdate = base.matrixAutoUpdate;
  texture.matrix.copy(base.matrix);
}
