import { cinematicSceneSchema, type CinematicScene } from "@guildhub/contracts";

const durationMs = 8_000;
const origin = { x: 0, y: 0, z: 0 };
/**
 * Three-quarter turn like the in-game character screen: held weapons point
 * forward in the stand pose and would collapse into a stub head-on.
 */
const threeQuarterTurn = -0.45;
const facingCamera = { x: 0, y: -Math.PI / 2 + threeQuarterTurn, z: 0 };
const actorScale = 1.2;
const settled = {
  position: origin,
  rotation: facingCamera,
  scale: { x: actorScale, y: actorScale, z: actorScale },
};
const fov = 32;
/** Share of the frame height above and below the figure's centre. */
const headroom = 0.68;

/** Frames a figure of the given model height, feet to crown, with headroom. */
export const idleCamera = (figureHeight: number) => {
  const height = figureHeight * actorScale;
  const centre = height * 0.5;
  const distance = (height * headroom) / Math.tan(((fov / 2) * Math.PI) / 180);
  return {
    position: { x: 0, y: centre + height * 0.1, z: distance },
    target: { x: 0, y: centre + height * 0.02, z: 0 },
    fov,
  };
};

/** The belt line and the crown, as shares of the standing height. */
const bustSpan = { bottom: 0.4, top: 1.38 } as const;

/** Frames the figure from the belt up, as for a portrait. */
export const bustCamera = (figureHeight: number) => {
  const height = figureHeight * actorScale;
  const bottom = height * bustSpan.bottom;
  const top = height * bustSpan.top;
  const centre = (bottom + top) / 2;
  const distance = (top - bottom) / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
  return {
    position: { x: 0, y: centre + height * 0.04, z: distance },
    target: { x: 0, y: centre, z: 0 },
    fov,
  };
};

export type IdleFraming = "full" | "bust";

const cameraByFraming: Readonly<
  Record<IdleFraming, (figureHeight: number) => ReturnType<typeof idleCamera>>
> = { full: idleCamera, bust: bustCamera };

const keyLight = {
  position: { x: 2.1, y: 3.8, z: 3.1 },
  color: "#f2e6c9",
  intensity: 2.45,
};
const fillLight = {
  position: { x: -2.8, y: 1.5, z: 2.1 },
  color: "#7d9a6a",
  intensity: 0.68,
};
const ui = {
  opacity: 1,
  translation: origin,
  scale: 1,
  blur: 0,
};
const stand = {
  animationGroup: "Stand",
  id: "animation-0",
  crossfadeMs: 0,
  playback: { rate: 1, loop: true, clampWhenFinished: false },
};

export function buildCharacterIdleScene(input: {
  readonly id: string;
  readonly manifest: string;
  /** Standing model height at scale 1. */
  readonly figureHeight: number;
  readonly framing?: IdleFraming;
}): CinematicScene {
  const camera = cameraByFraming[input.framing ?? "full"](input.figureHeight);
  return cinematicSceneSchema.parse({
    id: "character-idle",
    schemaVersion: 1,
    durationMs,
    loop: true,
    declarations: [
      {
        kind: "actor",
        id: input.id,
        manifest: input.manifest,
        character: input.id,
      },
      { kind: "asset", id: "camera", asset: "stage-camera" },
      { kind: "asset", id: "key-light", asset: "key" },
      { kind: "asset", id: "fill-light", asset: "fill" },
      { kind: "asset", id: "stage-ui", asset: "cinematic-stage" },
    ],
    markers: [{ id: "idle", timeMs: 0 }],
    phases: [{ id: "idle", startMs: 0, endMs: durationMs }],
    tracks: [
      {
        kind: "camera",
        id: "idle-camera",
        target: "camera",
        keyframes: [
          { timeMs: 0, value: camera },
          { timeMs: durationMs, value: camera },
        ],
      },
      {
        kind: "light",
        id: "idle-key",
        target: "key-light",
        keyframes: [
          { timeMs: 0, value: keyLight },
          { timeMs: durationMs, value: keyLight },
        ],
      },
      {
        kind: "light",
        id: "idle-fill",
        target: "fill-light",
        keyframes: [
          { timeMs: 0, value: fillLight },
          { timeMs: durationMs, value: fillLight },
        ],
      },
      {
        kind: "ui",
        id: "idle-ui",
        target: "stage-ui",
        keyframes: [
          { timeMs: 0, value: ui },
          { timeMs: durationMs, value: ui },
        ],
      },
      {
        kind: "clip",
        id: "idle-clip",
        target: input.id,
        keyframes: [
          { timeMs: 0, value: stand },
          { timeMs: durationMs, value: stand },
        ],
      },
      {
        kind: "transform",
        id: "idle-transform",
        target: input.id,
        keyframes: [
          { timeMs: 0, value: settled },
          { timeMs: durationMs, value: settled },
        ],
      },
      {
        kind: "visibility",
        id: "idle-visibility",
        target: input.id,
        keyframes: [
          { timeMs: 0, value: true },
          { timeMs: durationMs, value: true },
        ],
      },
    ],
  });
}
