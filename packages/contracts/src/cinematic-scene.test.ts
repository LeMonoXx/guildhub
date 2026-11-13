import { describe, expect, it } from "vitest";
import {
  cinematicSceneSchema,
  cinematicTrackSchema,
  type CinematicScene,
} from "./index.js";

const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

const at = <T>(values: readonly T[], index: number): T => {
  const value = values.at(index);
  if (value === undefined) {
    throw new Error(`Expected item at index ${String(index)}`);
  }
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const recordAt = (
  values: readonly unknown[],
  index: number,
): Record<string, unknown> => {
  const value = values.at(index);
  if (!isRecord(value)) {
    throw new Error(`Expected object at index ${String(index)}`);
  }
  return value;
};

const arrayProperty = (
  value: Record<string, unknown>,
  property: string,
): readonly unknown[] => {
  const propertyValue = value[property];
  if (!Array.isArray(propertyValue)) {
    throw new Error(`Expected ${property} to be an array`);
  }
  return propertyValue;
};

const recordProperty = (
  value: Record<string, unknown>,
  property: string,
): Record<string, unknown> => {
  const propertyValue = value[property];
  if (!isRecord(propertyValue)) {
    throw new Error(`Expected ${property} to be an object`);
  }
  return propertyValue;
};

const rogueLikeScene = () => ({
  id: "class-intro.shadow",
  schemaVersion: 1,
  durationMs: 12_000,
  loop: false,
  declarations: [
    {
      kind: "actor",
      id: "hero",
      manifest: "fixed-look/class-intro-v1",
      character: "characters/shadow-scout",
    },
    { kind: "asset", id: "camera.main", asset: "cameras/class-intro" },
    { kind: "asset", id: "key-light", asset: "lights/moon-key" },
    { kind: "asset", id: "title", asset: "ui/class-title" },
    { kind: "asset", id: "embers", asset: "effects/embers" },
    { kind: "asset", id: "fog", asset: "effects/ground-fog" },
    { kind: "asset", id: "music", asset: "audio/class-intro" },
  ],
  markers: [
    { id: "reveal", timeMs: 1_500 },
    { id: "title", timeMs: 7_500 },
  ],
  phases: [
    { id: "arrival", startMs: 0, endMs: 4_000 },
    { id: "showcase", startMs: 4_000, endMs: 9_000 },
    { id: "resolve", startMs: 9_000, endMs: 12_000 },
  ],
  tracks: [
    {
      kind: "clip",
      id: "hero.animation",
      target: "hero",
      keyframes: [
        {
          timeMs: 0,
          value: {
            animationGroup: "class-intro",
            id: "idle-ready",
            crossfadeMs: 250,
            playback: { rate: 1, loop: true, clampWhenFinished: false },
          },
        },
        {
          timeMs: 4_000,
          easing: "ease-in-out",
          value: {
            animationGroup: "class-intro",
            id: "weapon-flourish",
            crossfadeMs: 350,
            playback: { rate: 1, loop: false, clampWhenFinished: true },
          },
        },
      ],
    },
    {
      kind: "transform",
      id: "hero.transform",
      target: "hero",
      keyframes: [
        {
          timeMs: 0,
          value: {
            position: vec3(0, 0, -2),
            rotation: vec3(0, 180, 0),
            scale: vec3(1, 1, 1),
          },
        },
        {
          timeMs: 5_000,
          easing: "ease-out",
          value: {
            position: vec3(0, 0, 0),
            rotation: vec3(0, 160, 0),
            scale: vec3(1, 1, 1),
          },
        },
      ],
    },
    {
      kind: "camera",
      id: "camera.move",
      target: "camera.main",
      keyframes: [
        {
          timeMs: 0,
          value: { position: vec3(0, 2, 8), target: vec3(0, 1, 0), fov: 50 },
        },
        {
          timeMs: 12_000,
          easing: "ease-in-out",
          value: {
            position: vec3(2, 1.5, 5),
            target: vec3(0, 1.2, 0),
            fov: 38,
          },
        },
      ],
    },
    {
      kind: "light",
      id: "moon.key",
      target: "key-light",
      keyframes: [
        {
          timeMs: 0,
          value: { position: vec3(-3, 5, 2), color: "#9bbcff", intensity: 0 },
        },
        {
          timeMs: 2_000,
          value: {
            position: vec3(-3, 5, 2),
            color: "#9bbcff",
            intensity: 1_200,
          },
        },
      ],
    },
    {
      kind: "visibility",
      id: "hero.visibility",
      target: "hero",
      keyframes: [
        { timeMs: 0, value: false },
        { timeMs: 1_500, easing: "step", value: true },
      ],
    },
    {
      kind: "ui",
      id: "title.reveal",
      target: "title",
      keyframes: [
        {
          timeMs: 0,
          value: {
            opacity: 0,
            translation: vec3(0, 24, 0),
            scale: 0.95,
            blur: 12,
          },
        },
        {
          timeMs: 7_500,
          easing: "ease-out",
          value: {
            opacity: 1,
            translation: vec3(),
            scale: 1,
            blur: 0,
          },
        },
      ],
    },
    {
      kind: "emitter",
      id: "embers.motion",
      target: "embers",
      seed: 42,
      keyframes: [
        {
          timeMs: 0,
          value: {
            rate: 20,
            lifetimeMs: 2_000,
            velocity: vec3(0, 0.7, 0),
            spread: 35,
          },
        },
      ],
    },
    {
      kind: "smoke",
      id: "fog.motion",
      target: "fog",
      seed: 7,
      keyframes: [
        {
          timeMs: 0,
          value: {
            density: 0.65,
            drift: vec3(0.1, 0, 0),
            size: 3,
            opacity: 0.45,
          },
        },
      ],
    },
    {
      kind: "audio",
      id: "music.cues",
      target: "music",
      keyframes: [
        {
          timeMs: 0,
          value: {
            asset: "audio/class-intro",
            cue: "intro-sting",
            gain: 0,
          },
        },
      ],
    },
  ],
});

describe("cinematicSceneSchema", () => {
  it("accepts a broad Rogue-like scene with every track kind", () => {
    const result = cinematicSceneSchema.safeParse(rogueLikeScene());

    expect(result.success).toBe(true);
    if (result.success) {
      const typed: CinematicScene = result.data;
      expect(typed.tracks.map(({ kind }) => kind)).toEqual([
        "clip",
        "transform",
        "camera",
        "light",
        "visibility",
        "ui",
        "emitter",
        "smoke",
        "audio",
      ]);
    }
  });

  it("supports prepared silent audio cues without requiring playback data", () => {
    const audio = rogueLikeScene().tracks.at(-1);

    expect(cinematicTrackSchema.parse(audio)).toMatchObject({
      kind: "audio",
      keyframes: [
        {
          value: {
            asset: "audio/class-intro",
            cue: "intro-sting",
            gain: 0,
          },
        },
      ],
    });
  });

  it.each([0, 2, -1, 1.5])("rejects schema version %s", (schemaVersion) => {
    expect(
      cinematicSceneSchema.safeParse({
        ...rogueLikeScene(),
        schemaVersion,
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range and unordered timeline values", () => {
    const scene = rogueLikeScene();
    scene.markers = [
      { id: "late", timeMs: 12_001 },
      { id: "earlier", timeMs: 1_000 },
    ];
    scene.phases = [{ id: "bad", startMs: 6_000, endMs: 5_000 }];
    const clipTrack = recordAt(scene.tracks, 0);
    if (clipTrack.kind !== "clip") {
      throw new Error("Expected the first track to be a clip track");
    }
    recordAt(arrayProperty(clipTrack, "keyframes"), 1).timeMs = 0;

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });

  it("accepts ordered, non-overlapping phases with gaps", () => {
    const scene = rogueLikeScene();
    scene.phases = [
      { id: "opening", startMs: 0, endMs: 2_000 },
      { id: "reveal", startMs: 3_000, endMs: 5_000 },
      { id: "resolve", startMs: 8_000, endMs: 12_000 },
    ];

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(true);
  });

  it.each([
    [
      "overlapping intervals",
      [
        { id: "opening", startMs: 0, endMs: 5_000 },
        { id: "reveal", startMs: 4_000, endMs: 7_000 },
      ],
    ],
    [
      "duplicate start boundaries",
      [
        { id: "opening", startMs: 0, endMs: 2_000 },
        { id: "reveal", startMs: 0, endMs: 1_000 },
      ],
    ],
    [
      "unordered intervals",
      [
        { id: "reveal", startMs: 5_000, endMs: 7_000 },
        { id: "opening", startMs: 1_000, endMs: 2_000 },
      ],
    ],
    [
      "intervals beyond the duration",
      [{ id: "late", startMs: 11_000, endMs: 12_001 }],
    ],
  ])("rejects phase %s", (_label, phases) => {
    const scene = rogueLikeScene();
    scene.phases = phases;

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });

  it.each([
    [
      "declaration IDs",
      (scene: ReturnType<typeof rogueLikeScene>) => {
        scene.declarations.push({ ...at(scene.declarations, 0) });
      },
    ],
    [
      "marker IDs",
      (scene: ReturnType<typeof rogueLikeScene>) => {
        scene.markers.push({ id: "reveal", timeMs: 2_000 });
      },
    ],
    [
      "phase IDs",
      (scene: ReturnType<typeof rogueLikeScene>) => {
        scene.phases.push({ id: "arrival", startMs: 10_000, endMs: 11_000 });
      },
    ],
    [
      "track IDs",
      (scene: ReturnType<typeof rogueLikeScene>) => {
        at(scene.tracks, 1).id = at(scene.tracks, 0).id;
      },
    ],
    [
      "kind/target pairs",
      (scene: ReturnType<typeof rogueLikeScene>) => {
        scene.tracks.push({
          ...at(scene.tracks, 4),
          id: "hero.visibility-again",
        });
      },
    ],
  ])("rejects duplicate %s", (_label, mutate) => {
    const scene = rogueLikeScene();
    mutate(scene);

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rejects unknown track targets", () => {
    const scene = rogueLikeScene();
    at(scene.tracks, 0).target = "missing";

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rejects unknown keys at scene and nested boundaries", () => {
    expect(
      cinematicSceneSchema.safeParse({
        ...rogueLikeScene(),
        surprise: true,
      }).success,
    ).toBe(false);

    const scene = rogueLikeScene();
    (at(scene.declarations, 0) as unknown as Record<string, unknown>).extra =
      "not allowed";
    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });

  it("enforces seamless endpoints for looped state tracks", () => {
    const base = {
      id: "loop",
      schemaVersion: 1,
      durationMs: 1_000,
      loop: true,
      declarations: [{ kind: "asset", id: "fog", asset: "effects/fog" }],
      markers: [],
      phases: [],
      tracks: [
        {
          kind: "smoke",
          id: "fog.loop",
          target: "fog",
          seed: 99,
          keyframes: [
            {
              timeMs: 0,
              value: {
                density: 0.5,
                drift: vec3(0.1),
                size: 2,
                opacity: 0.4,
              },
            },
            {
              timeMs: 1_000,
              value: {
                density: 0.5,
                drift: vec3(0.1),
                size: 2,
                opacity: 0.4,
              },
            },
          ],
        },
      ],
    };

    expect(cinematicSceneSchema.safeParse(base).success).toBe(true);
    (at(at(base.tracks, 0).keyframes, 1).value as { opacity: number }).opacity =
      0.8;
    expect(cinematicSceneSchema.safeParse(base).success).toBe(false);
  });

  it("rejects non-finite, negative, and bounded values", () => {
    const scene = rogueLikeScene();
    scene.durationMs = Number.POSITIVE_INFINITY;
    const uiTrack = recordAt(scene.tracks, 5);
    if (uiTrack.kind !== "ui") {
      throw new Error("Expected the sixth track to be a UI track");
    }
    const uiKeyframe = recordAt(arrayProperty(uiTrack, "keyframes"), 0);
    recordProperty(uiKeyframe, "value").opacity = 1.1;

    const emitterTrack = recordAt(scene.tracks, 6);
    if (emitterTrack.kind !== "emitter") {
      throw new Error("Expected the seventh track to be an emitter track");
    }
    emitterTrack.seed = -1;

    expect(cinematicSceneSchema.safeParse(scene).success).toBe(false);
  });
});
