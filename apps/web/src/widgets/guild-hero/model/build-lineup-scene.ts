import {
  cinematicSceneSchema,
  type CinematicScene,
  type FeaturedMember,
} from "@guildhub/contracts";

const durationMs = 12000;
const origin = { x: 0, y: 0, z: 0 };

const slotTransform = (index: number, count: number, settled: boolean) => {
  const spread = (index - (count - 1) / 2) * 1.28;
  return {
    position: {
      x: spread,
      y: 0,
      z: settled ? Math.abs(spread) * 0.08 : 2.4,
    },
    rotation: origin,
    scale: { x: 0.62, y: 0.62, z: 0.62 },
  };
};

const hold = <T>(value: T) => [
  { timeMs: 0, value },
  { timeMs: durationMs, value },
];

export const buildLineupScene = (
  members: readonly FeaturedMember[],
): CinematicScene => {
  const actors = members.map((member) => ({
    kind: "actor" as const,
    id: member.slug,
    manifest: member.lookManifest,
    character: member.slug,
  }));
  const camera = {
    position: { x: 0, y: 1.45, z: 8.6 },
    target: { x: 0, y: 0.95, z: 0 },
    fov: 32,
  };
  const keyLight = {
    position: { x: 2.2, y: 4, z: 3 },
    color: "#f2e6c9",
    intensity: 2.4,
  };
  const fillLight = {
    position: { x: -3, y: 1.6, z: 2 },
    color: "#7d9a6a",
    intensity: 0.55,
  };
  const ui = {
    opacity: 1,
    translation: origin,
    scale: 1,
    blur: 0,
  };

  return cinematicSceneSchema.parse({
    id: "guild-lineup",
    schemaVersion: 1,
    durationMs,
    loop: true,
    declarations: [
      ...actors,
      { kind: "asset", id: "camera", asset: "stage-camera" },
      { kind: "asset", id: "key-light", asset: "key" },
      { kind: "asset", id: "fill-light", asset: "fill" },
      { kind: "asset", id: "stage-ui", asset: "cinematic-stage" },
    ],
    markers: [
      { id: "enter", timeMs: 0 },
      { id: "hold", timeMs: 2400 },
      { id: "reset", timeMs: 11000 },
    ],
    phases: [
      { id: "enter", startMs: 0, endMs: 2400 },
      { id: "hold", startMs: 2400, endMs: durationMs },
    ],
    tracks: [
      {
        kind: "camera",
        id: "lineup-camera",
        target: "camera",
        keyframes: hold(camera),
      },
      {
        kind: "light",
        id: "lineup-key",
        target: "key-light",
        keyframes: hold(keyLight),
      },
      {
        kind: "light",
        id: "lineup-fill",
        target: "fill-light",
        keyframes: hold(fillLight),
      },
      {
        kind: "ui",
        id: "lineup-ui",
        target: "stage-ui",
        keyframes: hold(ui),
      },
      ...members.flatMap((member, index) => {
        const enterAt = 120 + index * 280;
        const settledAt = enterAt + 900;
        const clipValue = {
          animationGroup: member.pose,
          id: `${member.slug}-clip`,
          crossfadeMs: 0,
          playback: {
            rate: 1,
            loop: true,
            clampWhenFinished: false,
          },
          ...(member.overlay ? { overlay: member.overlay } : {}),
        };
        const offstage = slotTransform(index, members.length, false);
        const onstage = slotTransform(index, members.length, true);
        return [
          {
            kind: "clip" as const,
            id: `${member.slug}-clips`,
            target: member.slug,
            keyframes: hold(clipValue),
          },
          {
            kind: "transform" as const,
            id: `${member.slug}-transform`,
            target: member.slug,
            keyframes: [
              { timeMs: 0, value: offstage },
              {
                timeMs: settledAt,
                easing: "ease-out" as const,
                value: onstage,
              },
              { timeMs: durationMs, value: offstage },
            ],
          },
          {
            kind: "visibility" as const,
            id: `${member.slug}-visibility`,
            target: member.slug,
            keyframes: [
              { timeMs: 0, value: false },
              { timeMs: enterAt, value: true },
              { timeMs: durationMs, value: false },
            ],
          },
        ];
      }),
    ],
  });
};
