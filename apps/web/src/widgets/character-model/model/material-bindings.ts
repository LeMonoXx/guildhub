import * as THREE from "three";
import type { MaterialAnimation, MaterialAnimationKind } from "./types";

export type ColorMaterial = THREE.Material & {
  color: THREE.Color;
  opacity: number;
  transparent: boolean;
};

export interface MaterialAnimationBinding {
  material: ColorMaterial;
  texture?: THREE.Texture;
  colorIndex?: number | null;
  textureWeightIndex?: number | null;
  textureTransformIndex?: number | null;
}

/** One sample of every animatable material value, before it touches the material. */
export interface MaterialFrame {
  rgb: number[];
  colorAlpha: number;
  transparencyAlpha: number;
  translation: number[];
  rotation?: number;
  scaling: number[];
}

export type FrameWriter = (frame: MaterialFrame, values: number[]) => void;

type BindingCompiler = (
  binding: MaterialAnimationBinding,
  track: MaterialAnimation,
) => FrameWriter | undefined;

export const initialMaterialFrame = (): MaterialFrame => ({
  rgb: [1, 1, 1],
  colorAlpha: 1,
  transparencyAlpha: 1,
  translation: [0, 0],
  scaling: [1, 1],
});

const targets = (
  index: number | null | undefined,
  track: MaterialAnimation,
): boolean =>
  index !== null && index !== undefined && index === track.targetIndex;

const quaternionPlaneAngle = (values: number[]): number => {
  const [x = 0, y = 0, z = 0, w = 1] = values;
  const quaternion = new THREE.Quaternion(x, y, z, w).normalize();
  return Math.atan2(
    2 * (quaternion.w * quaternion.z + quaternion.x * quaternion.y),
    1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z),
  );
};

/** Maps a track kind to the frame field it writes, if the track targets the binding. */
export class MaterialBindingRegistry {
  private readonly compilers = new Map<
    MaterialAnimationKind,
    BindingCompiler
  >();

  register(kind: MaterialAnimationKind, compiler: BindingCompiler): this {
    this.compilers.set(kind, compiler);
    return this;
  }

  compile(
    binding: MaterialAnimationBinding,
    track: MaterialAnimation,
  ): FrameWriter | undefined {
    return this.compilers.get(track.kind)?.(binding, track);
  }
}

const colorWriter =
  (write: FrameWriter): BindingCompiler =>
  (binding, track) =>
    targets(binding.colorIndex, track) ? write : undefined;

const transformWriter =
  (write: FrameWriter): BindingCompiler =>
  (binding, track) =>
    binding.texture && targets(binding.textureTransformIndex, track)
      ? write
      : undefined;

export const defaultMaterialBindings = new MaterialBindingRegistry()
  .register(
    "color.rgb",
    colorWriter((frame, values) => {
      frame.rgb = values;
    }),
  )
  .register(
    "color.alpha",
    colorWriter((frame, values) => {
      frame.colorAlpha = values[0] ?? 1;
    }),
  )
  .register("transparency.alpha", (binding, track) =>
    targets(binding.textureWeightIndex, track)
      ? (frame, values) => {
          frame.transparencyAlpha = values[0] ?? 1;
        }
      : undefined,
  )
  .register(
    "textureTransform.translation",
    transformWriter((frame, values) => {
      frame.translation = values;
    }),
  )
  .register(
    "textureTransform.rotation",
    transformWriter((frame, values) => {
      frame.rotation = quaternionPlaneAngle(values);
    }),
  )
  .register(
    "textureTransform.scaling",
    transformWriter((frame, values) => {
      frame.scaling = values;
    }),
  );
