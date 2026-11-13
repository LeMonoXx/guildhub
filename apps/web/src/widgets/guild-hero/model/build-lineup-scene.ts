import {
  cinematicSceneSchema,
  type AnimationOverlay,
  type CinematicScene,
  type FeaturedMember,
} from "@guildhub/contracts";
import { arrangeTroop, type Pose, type TroopPlace } from "./arrange-troop";

const durationMs = 22_000;
const origin = { x: 0, y: 0, z: 0 };
const facingCamera = { x: 0, y: -Math.PI / 2, z: 0 };
const settledScale = { x: 1.32, y: 1.32, z: 1.32 };
const idlePool = ["Stand", "Ready1H", "StealthStand"] as const;
const enterStaggerMs = 500;
const enterPhaseEndMs = 9600;

export type ApproachSide = "left" | "right" | "back";

interface WalkFlavor {
  readonly clip: "Walk" | "StealthWalk";
  readonly rate: number;
  readonly travelMs: number;
}

const walkFlavors: readonly [WalkFlavor, ...WalkFlavor[]] = [
  { clip: "Walk", rate: 0.78, travelMs: 5200 },
  { clip: "StealthWalk", rate: 0.74, travelMs: 5600 },
  { clip: "Walk", rate: 0.8, travelMs: 5000 },
  { clip: "Walk", rate: 0.76, travelMs: 5400 },
  { clip: "StealthWalk", rate: 0.72, travelMs: 5800 },
  { clip: "Walk", rate: 0.79, travelMs: 5100 },
];

const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const shuffle = <T>(items: readonly T[], seed: number): T[] => {
  const next = [...items];
  let state = seed;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b);
    const swap = state % (index + 1);
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) continue;
    next[index] = other;
    next[swap] = current;
  }
  return next;
};

export const facingToward = (from: Pose, to: Pose) => {
  const yaw = Math.atan2(-(to.z - from.z), to.x - from.x);
  return { x: 0, y: yaw > Math.PI / 2 ? yaw - 2 * Math.PI : yaw, z: 0 };
};

export const approachSides = (
  places: readonly TroopPlace[],
): ApproachSide[] => {
  if (places.length === 0) return [];
  let leftIndex = 0;
  let rightIndex = 0;
  let leftX = Number.POSITIVE_INFINITY;
  let rightX = Number.NEGATIVE_INFINITY;
  places.forEach((place, index) => {
    if (place.slot.x < leftX) {
      leftX = place.slot.x;
      leftIndex = index;
    }
    if (place.slot.x > rightX) {
      rightX = place.slot.x;
      rightIndex = index;
    }
  });
  return places.map((_, index) => {
    if (places.length === 1) return "back";
    if (index === leftIndex) return "left";
    if (index === rightIndex) return "right";
    return "back";
  });
};

export const approachStart = (
  slot: Pose,
  side: ApproachSide,
  lane = 0,
): Pose => {
  if (side === "left") {
    return { x: slot.x - 6.2, y: 0, z: slot.z - 0.55 - lane * 0.7 };
  }
  if (side === "right") {
    return { x: slot.x + 6.2, y: 0, z: slot.z - 0.55 - lane * 0.7 };
  }
  return {
    x: slot.x * 1.55 + (lane % 2 === 0 ? -0.18 : 0.18) * lane,
    y: 0,
    z: slot.z - 2.65 - lane * 0.4,
  };
};

const asTransform = (
  position: Pose,
  rotation: { x: number; y: number; z: number },
) => ({
  position,
  rotation,
  scale: settledScale,
});

const clipValue = (
  animationGroup: string,
  id: string,
  extras: {
    readonly rate?: number;
    readonly crossfadeMs?: number;
    readonly loop?: boolean;
    readonly overlay?: AnimationOverlay;
  } = {},
) => ({
  animationGroup,
  id,
  crossfadeMs: extras.crossfadeMs ?? 0,
  playback: {
    rate: extras.rate ?? 1,
    loop: extras.loop ?? true,
    clampWhenFinished: extras.loop === false,
  },
  ...(extras.overlay ? { overlay: extras.overlay } : {}),
});

const stancePose = (pose: string): string =>
  pose === "Walk" || pose === "Run" || pose === "KneelLoop" ? "Stand" : pose;

const idleSequence = (seedText: string, hold: string): readonly string[] => {
  const seed = hashString(seedText);
  const pool = shuffle([...new Set([hold, ...idlePool])], seed);
  const beats = 3 + (seed % 2);
  const sequence: string[] = [hold];
  let state = seed;
  for (let index = 1; index < beats; index += 1) {
    state = Math.imul(state ^ (state >>> 13), 0x5bd1e995);
    const choice = pool[Math.abs(state) % pool.length] ?? hold;
    const previous = sequence.at(-1);
    sequence.push(
      choice === previous
        ? (pool[(pool.indexOf(choice) + 1) % pool.length] ?? "Stand")
        : choice,
    );
  }
  return sequence;
};

const flavorFor = (index: number): WalkFlavor =>
  walkFlavors[index % walkFlavors.length] ?? walkFlavors[0];

export const buildLineupScene = (
  members: readonly FeaturedMember[],
): CinematicScene => {
  const places = arrangeTroop(members);
  const actors = places.map((place) => ({
    kind: "actor" as const,
    id: place.member.slug,
    manifest: place.member.lookManifest,
    character: place.member.slug,
  }));
  const camera = {
    position: { x: 0, y: 2.05, z: 9.55 },
    target: { x: 0, y: 1.12, z: 0.4 },
    fov: 38,
  };
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

  const sides = approachSides(places);

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
      { id: "assembled", timeMs: enterPhaseEndMs },
      { id: "reset", timeMs: 20_400 },
    ],
    phases: [
      { id: "enter", startMs: 0, endMs: enterPhaseEndMs },
      { id: "hold", startMs: enterPhaseEndMs, endMs: durationMs },
    ],
    tracks: [
      {
        kind: "camera",
        id: "lineup-camera",
        target: "camera",
        keyframes: [
          { timeMs: 0, value: camera },
          { timeMs: durationMs, value: camera },
        ],
      },
      {
        kind: "light",
        id: "lineup-key",
        target: "key-light",
        keyframes: [
          { timeMs: 0, value: keyLight },
          { timeMs: durationMs, value: keyLight },
        ],
      },
      {
        kind: "light",
        id: "lineup-fill",
        target: "fill-light",
        keyframes: [
          { timeMs: 0, value: fillLight },
          { timeMs: durationMs, value: fillLight },
        ],
      },
      {
        kind: "ui",
        id: "lineup-ui",
        target: "stage-ui",
        keyframes: [
          { timeMs: 0, value: ui },
          { timeMs: durationMs, value: ui },
        ],
      },
      ...places.flatMap((place, index) =>
        actorTracks(
          place,
          index,
          flavorFor(index),
          sides[index] ?? "back",
          laneBySide(sides, index),
        ),
      ),
    ],
  });
};

export const laneBySide = (
  sides: readonly ApproachSide[],
  index: number,
): number => {
  const side = sides[index];
  if (side === undefined) return 0;
  let lane = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (sides[cursor] === side) lane += 1;
  }
  return lane;
};

const actorTracks = (
  place: TroopPlace,
  index: number,
  flavor: WalkFlavor,
  side: ApproachSide,
  lane: number,
) => {
  const { member, slot, kneels } = place;
  const start = approachStart(slot, side, lane);
  const heading = facingToward(start, slot);
  const onstage = asTransform(slot, facingCamera);
  const walking = asTransform(slot, heading);
  const offstage = asTransform(start, heading);
  const enterAt = 40 + index * enterStaggerMs;
  const settledAt = enterAt + flavor.travelMs;
  const plantedAt = settledAt + 280;
  const facedAt = plantedAt + 420;
  const leaveAt = durationMs - 80;
  const spawnClip = clipValue(flavor.clip, `${member.slug}-enter`, {
    rate: flavor.rate,
  });
  const hold = stancePose(member.pose);
  const clipKeyframes = [{ timeMs: 0, value: spawnClip }];
  if (kneels) {
    clipKeyframes.push(
      {
        timeMs: settledAt,
        value: clipValue(hold, `${member.slug}-plant`, { crossfadeMs: 180 }),
      },
      {
        timeMs: facedAt + 80,
        value: clipValue("KneelStart", `${member.slug}-kneel-start`, {
          crossfadeMs: 140,
          loop: false,
        }),
      },
      {
        timeMs: facedAt + 860,
        value: clipValue("KneelLoop", `${member.slug}-kneel`, {
          crossfadeMs: 80,
        }),
      },
    );
  } else {
    let cursor = settledAt;
    idleSequence(member.slug, hold).forEach((animationGroup, idleIndex) => {
      if (cursor >= leaveAt - 200) return;
      clipKeyframes.push({
        timeMs: cursor,
        value: clipValue(
          animationGroup,
          `${member.slug}-idle-${String(idleIndex)}`,
          {
            crossfadeMs: 240,
          },
        ),
      });
      cursor +=
        2200 + (hashString(`${member.slug}:${String(idleIndex)}`) % 9) * 80;
    });
  }
  clipKeyframes.push({ timeMs: durationMs, value: spawnClip });

  return [
    {
      kind: "clip" as const,
      id: `${member.slug}-clips`,
      target: member.slug,
      keyframes: clipKeyframes,
    },
    {
      kind: "transform" as const,
      id: `${member.slug}-transform`,
      target: member.slug,
      keyframes: [
        { timeMs: 0, value: offstage },
        { timeMs: enterAt, value: offstage },
        {
          timeMs: settledAt,
          easing: "ease-out" as const,
          value: walking,
        },
        { timeMs: plantedAt, value: walking },
        {
          timeMs: facedAt,
          easing: "ease-in-out" as const,
          value: onstage,
        },
        { timeMs: leaveAt, value: onstage },
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
        { timeMs: leaveAt, value: false },
        { timeMs: durationMs, value: false },
      ],
    },
  ];
};
