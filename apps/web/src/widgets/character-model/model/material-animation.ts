import * as THREE from "three";
import type { MaterialAnimation, MaterialAnimationKind } from "../../../types";
import type { TimelineParticipant } from "./lifecycle";
import { sampleTrack } from "./track-sampler";

type ColorMaterial = THREE.Material & {
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

interface Frame {
  rgb: number[];
  colorAlpha: number;
  transparencyAlpha: number;
  translation: number[];
  rotation?: number;
  scaling: number[];
}

interface BindingState {
  binding: MaterialAnimationBinding;
  color: THREE.Color;
  opacity: number;
  transparent: boolean;
  offset?: THREE.Vector2;
  repeat?: THREE.Vector2;
  center?: THREE.Vector2;
  rotation?: number;
  matrix?: THREE.Matrix3;
  matrixAutoUpdate?: boolean;
}

interface CompiledChannel {
  bindingIndex: number;
  tracks: readonly MaterialAnimation[];
  apply(frame: Frame, values: number[]): void;
}

type BindingCompiler = (
  binding: MaterialAnimationBinding,
  track: MaterialAnimation,
) => ((frame: Frame, values: number[]) => void) | undefined;

const target = (
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
  ): ((frame: Frame, values: number[]) => void) | undefined {
    return this.compilers.get(track.kind)?.(binding, track);
  }
}

export const defaultMaterialBindings = new MaterialBindingRegistry()
  .register("color.rgb", (binding, track) =>
    target(binding.colorIndex, track)
      ? (frame, values) => {
          frame.rgb = values;
        }
      : undefined,
  )
  .register("color.alpha", (binding, track) =>
    target(binding.colorIndex, track)
      ? (frame, values) => {
          frame.colorAlpha = values[0] ?? 1;
        }
      : undefined,
  )
  .register("transparency.alpha", (binding, track) =>
    target(binding.textureWeightIndex, track)
      ? (frame, values) => {
          frame.transparencyAlpha = values[0] ?? 1;
        }
      : undefined,
  )
  .register("textureTransform.translation", (binding, track) =>
    binding.texture && target(binding.textureTransformIndex, track)
      ? (frame, values) => {
          frame.translation = values;
        }
      : undefined,
  )
  .register("textureTransform.rotation", (binding, track) =>
    binding.texture && target(binding.textureTransformIndex, track)
      ? (frame, values) => {
          frame.rotation = quaternionPlaneAngle(values);
        }
      : undefined,
  )
  .register("textureTransform.scaling", (binding, track) =>
    binding.texture && target(binding.textureTransformIndex, track)
      ? (frame, values) => {
          frame.scaling = values;
        }
      : undefined,
  );

const channelKey = (bindingIndex: number, track: MaterialAnimation): string =>
  `${String(bindingIndex)}:${track.kind}:${String(track.targetIndex)}`;

const variation = (track: MaterialAnimation): number => track.variation ?? 0;

const selectedTrack = (
  tracks: readonly MaterialAnimation[],
  sequenceId: number,
): MaterialAnimation | undefined =>
  tracks.find(
    (track) =>
      track.globalSequence !== null && track.globalSequence !== undefined,
  ) ??
  tracks
    .filter((track) => (track.sequenceId ?? 0) === sequenceId)
    .sort((left, right) => variation(left) - variation(right))[0];

const initialFrame = (): Frame => ({
  rgb: [1, 1, 1],
  colorAlpha: 1,
  transparencyAlpha: 1,
  translation: [0, 0],
  scaling: [1, 1],
});

const validAlpha = (value: number): number =>
  Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1;

export class MaterialAnimationController implements TimelineParticipant {
  private readonly states: BindingState[];
  private readonly channels: CompiledChannel[];
  private readonly reported = new Set<string>();
  private time = 0;
  private sequenceId: number;
  private disposed = false;

  constructor(
    bindings: readonly MaterialAnimationBinding[],
    tracks: readonly MaterialAnimation[],
    private readonly timeScale = 1,
    defaultSequenceId = 0,
    registry: MaterialBindingRegistry = defaultMaterialBindings,
    private readonly report?: (message: string) => void,
  ) {
    this.sequenceId = defaultSequenceId;
    this.states = bindings.map((binding) => ({
      binding,
      color: binding.material.color.clone(),
      opacity: binding.material.opacity,
      transparent: binding.material.transparent,
      offset: binding.texture?.offset.clone(),
      repeat: binding.texture?.repeat.clone(),
      center: binding.texture?.center.clone(),
      rotation: binding.texture?.rotation,
      matrix: binding.texture?.matrix.clone(),
      matrixAutoUpdate: binding.texture?.matrixAutoUpdate,
    }));
    const grouped = new Map<
      string,
      {
        bindingIndex: number;
        tracks: MaterialAnimation[];
        apply: CompiledChannel["apply"];
      }
    >();
    bindings.forEach((binding, bindingIndex) => {
      for (const track of tracks) {
        const apply = registry.compile(binding, track);
        if (!apply) continue;
        const key = channelKey(bindingIndex, track);
        const channel = grouped.get(key);
        if (channel) channel.tracks.push(track);
        else grouped.set(key, { bindingIndex, tracks: [track], apply });
      }
    });
    this.channels = [...grouped.values()];
    this.applyTime();
  }

  selectSequence(sequenceId: number): void {
    if (this.disposed) return;
    this.sequenceId = sequenceId;
    this.time = 0;
    this.applyTime();
  }

  update(delta: number): void {
    if (this.disposed) return;
    this.time += Math.max(delta, 0) * Math.max(this.timeScale, 0);
    this.applyTime();
  }

  setTime(time: number): void {
    if (this.disposed) return;
    this.time = Math.max(time, 0) * Math.max(this.timeScale, 0);
    this.applyTime();
  }

  reset(): void {
    if (this.disposed) return;
    this.time = 0;
    this.applyTime();
  }

  private applyTime(): void {
    const frames = this.states.map(() => initialFrame());
    for (const channel of this.channels) {
      const track = selectedTrack(channel.tracks, this.sequenceId);
      if (!track) continue;
      const values = sampleTrack(track, this.time * 1000, [], {
        report: (message) => {
          if (this.reported.has(message)) return;
          this.reported.add(message);
          this.report?.(message);
        },
      });
      const frame = frames[channel.bindingIndex];
      if (frame) channel.apply(frame, values);
    }
    this.states.forEach((state, index) => {
      this.applyFrame(state, frames[index] ?? initialFrame());
    });
  }

  private applyFrame(state: BindingState, frame: Frame): void {
    const { material, texture } = state.binding;
    material.color
      .copy(state.color)
      .multiply(
        new THREE.Color(
          frame.rgb[0] ?? 1,
          frame.rgb[1] ?? 1,
          frame.rgb[2] ?? 1,
        ),
      );
    const opacity = THREE.MathUtils.clamp(
      state.opacity *
        validAlpha(frame.colorAlpha) *
        validAlpha(frame.transparencyAlpha),
      0,
      1,
    );
    material.opacity = opacity;
    const transparent = state.transparent || opacity < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    if (!texture || !state.offset || !state.repeat) return;
    texture.offset.set(
      state.offset.x + (frame.translation[0] ?? 0),
      state.offset.y + (frame.translation[1] ?? 0),
    );
    texture.repeat.set(
      state.repeat.x * (frame.scaling[0] ?? 1),
      state.repeat.y * (frame.scaling[1] ?? 1),
    );
    if (frame.rotation !== undefined) texture.center.set(0.5, 0.5);
    else if (state.center) texture.center.copy(state.center);
    texture.rotation = (state.rotation ?? 0) + (frame.rotation ?? 0);
    texture.updateMatrix();
  }

  private restoreBase(): void {
    for (const state of this.states) {
      const { material, texture } = state.binding;
      material.color.copy(state.color);
      material.opacity = state.opacity;
      if (material.transparent !== state.transparent) {
        material.transparent = state.transparent;
        material.needsUpdate = true;
      }
      if (
        !texture ||
        !state.offset ||
        !state.repeat ||
        !state.center ||
        !state.matrix ||
        state.rotation === undefined ||
        state.matrixAutoUpdate === undefined
      )
        continue;
      texture.offset.copy(state.offset);
      texture.repeat.copy(state.repeat);
      texture.center.copy(state.center);
      texture.rotation = state.rotation;
      texture.matrixAutoUpdate = state.matrixAutoUpdate;
      texture.matrix.copy(state.matrix);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.restoreBase();
    this.disposed = true;
  }
}
