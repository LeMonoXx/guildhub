import { lineupCamera } from "./stage-view";

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
const settledUi = {
  opacity: 1,
  translation: { x: 0, y: 0, z: 0 },
  scale: 1,
  blur: 0,
};
/** The stage fades up once everything has loaded instead of appearing at once. */
const loadedUi = { ...settledUi, opacity: 0, blur: 6 };
const fadeInMs = 900;

export const stageDeclarations = [
  { kind: "asset" as const, id: "camera", asset: "stage-camera" },
  { kind: "asset" as const, id: "key-light", asset: "key" },
  { kind: "asset" as const, id: "fill-light", asset: "fill" },
  { kind: "asset" as const, id: "stage-ui", asset: "cinematic-stage" },
];

const held = <T>(value: T, durationMs: number) => [
  { timeMs: 0, value },
  { timeMs: durationMs, value },
];

/** Camera, lights and UI stay put for the whole lineup. */
export const stageTracks = (durationMs: number) => [
  {
    kind: "camera" as const,
    id: "lineup-camera",
    target: "camera",
    keyframes: held(
      {
        position: { ...lineupCamera.position },
        target: { ...lineupCamera.target },
        fov: lineupCamera.fov,
      },
      durationMs,
    ),
  },
  {
    kind: "light" as const,
    id: "lineup-key",
    target: "key-light",
    keyframes: held(keyLight, durationMs),
  },
  {
    kind: "light" as const,
    id: "lineup-fill",
    target: "fill-light",
    keyframes: held(fillLight, durationMs),
  },
  {
    kind: "ui" as const,
    id: "lineup-ui",
    target: "stage-ui",
    keyframes: [
      { timeMs: 0, value: loadedUi },
      { timeMs: fadeInMs, value: settledUi, easing: "ease-out" as const },
      { timeMs: durationMs, value: settledUi },
    ],
  },
];
