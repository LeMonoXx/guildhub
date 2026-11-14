import { lineupScale, type Pose } from "./stage-view";

export interface Rotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ActorTransform {
  readonly position: Pose;
  readonly rotation: Rotation;
  readonly scale: Pose;
}

export interface ClipPlayback {
  readonly rate: number;
  readonly loop: boolean;
  readonly clampWhenFinished: boolean;
}

export interface ClipValue {
  readonly animationGroup: string;
  readonly id: string;
  readonly crossfadeMs: number;
  readonly playback: ClipPlayback;
}

export const facingCamera: Rotation = { x: 0, y: -Math.PI / 2, z: 0 };
const settledScale: Pose = { x: lineupScale, y: lineupScale, z: lineupScale };

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export const easeOutQuad = (progress: number): number =>
  1 - (1 - clamp01(progress)) ** 2;

export const easeInOutQuad = (progress: number): number => {
  const t = clamp01(progress);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

export const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

export const lerpPose = (from: Pose, to: Pose, t: number): Pose => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  z: lerp(from.z, to.z, t),
});

export const groundDistance = (from: Pose, to: Pose): number =>
  Math.hypot(to.x - from.x, to.z - from.z);

/** Yaw that faces from `from` toward `to`, kept on the camera's side of the turn. */
export const facingToward = (from: Pose, to: Pose): Rotation => {
  const yaw = Math.atan2(-(to.z - from.z), to.x - from.x);
  return { x: 0, y: yaw > Math.PI / 2 ? yaw - 2 * Math.PI : yaw, z: 0 };
};

export const lerpRotation = (
  from: Rotation,
  to: Rotation,
  t: number,
): Rotation => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  z: lerp(from.z, to.z, t),
});

export const actorTransform = (
  position: Pose,
  rotation: Rotation,
): ActorTransform => ({
  position,
  rotation,
  scale: settledScale,
});

export const clipValue = (
  animationGroup: string,
  id: string,
  options: {
    readonly rate?: number;
    readonly crossfadeMs?: number;
    readonly loop?: boolean;
  } = {},
): ClipValue => ({
  animationGroup,
  id,
  crossfadeMs: options.crossfadeMs ?? 0,
  playback: {
    rate: options.rate ?? 1,
    loop: options.loop ?? true,
    clampWhenFinished: options.loop === false,
  },
});
