import { z } from "zod";
import { checkSceneConstraints } from "./cinematic-scene.constraints.js";

const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Use a stable identifier");
const referenceSchema = z.string().min(1).max(512);
const timeSchema = z.number().nonnegative();
const unitSchema = z.number().min(0).max(1);
const positiveScaleSchema = z.number().positive().max(1000);

export const cinematicVec3Schema = z
  .strictObject({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .readonly();

export const cinematicEasingSchema = z.enum([
  "linear",
  "step",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

const keyframeShape = {
  timeMs: timeSchema,
  easing: cinematicEasingSchema.optional(),
};

export const cinematicKeyframeSchema = z.strictObject(keyframeShape).readonly();

const keyframe = <T extends z.ZodType>(value: T) =>
  z
    .strictObject({
      ...keyframeShape,
      value,
    })
    .readonly();

export const cinematicAssetDeclarationSchema = z
  .strictObject({
    kind: z.literal("asset"),
    id: idSchema,
    asset: referenceSchema,
  })
  .readonly();

export const cinematicActorDeclarationSchema = z
  .strictObject({
    kind: z.literal("actor"),
    id: idSchema,
    manifest: referenceSchema,
    character: referenceSchema,
  })
  .readonly();

export const cinematicDeclarationSchema = z.discriminatedUnion("kind", [
  cinematicAssetDeclarationSchema,
  cinematicActorDeclarationSchema,
]);

export const cinematicMarkerSchema = z
  .strictObject({
    id: idSchema,
    timeMs: timeSchema,
  })
  .readonly();

export const cinematicPhaseSchema = z
  .strictObject({
    id: idSchema,
    startMs: timeSchema,
    endMs: timeSchema,
  })
  .refine((phase) => phase.startMs < phase.endMs, {
    message: "Phase startMs must be before endMs",
    path: ["endMs"],
  })
  .readonly();

const playbackSchema = z
  .strictObject({
    rate: z.number().positive().max(16),
    loop: z.boolean(),
    clampWhenFinished: z.boolean(),
  })
  .readonly();

const animationOverlaySchema = z
  .strictObject({
    id: idSchema,
    animationGroup: referenceSchema,
    mask: z.enum(["upper-body"]),
    weight: unitSchema,
    fadeMs: timeSchema,
  })
  .readonly();

const transformValueSchema = z
  .strictObject({
    position: cinematicVec3Schema,
    rotation: cinematicVec3Schema,
    scale: z
      .strictObject({
        x: positiveScaleSchema,
        y: positiveScaleSchema,
        z: positiveScaleSchema,
      })
      .readonly(),
  })
  .readonly();

const clipKeyframeSchema = keyframe(
  z
    .strictObject({
      animationGroup: referenceSchema,
      id: referenceSchema,
      crossfadeMs: timeSchema,
      playback: playbackSchema,
      overlay: animationOverlaySchema.optional(),
    })
    .readonly(),
);

const transformKeyframeSchema = keyframe(transformValueSchema);

const cameraKeyframeSchema = keyframe(
  z
    .strictObject({
      position: cinematicVec3Schema,
      target: cinematicVec3Schema,
      fov: z.number().min(1).max(179),
    })
    .readonly(),
);

const lightKeyframeSchema = keyframe(
  z
    .strictObject({
      position: cinematicVec3Schema,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color"),
      intensity: z.number().nonnegative().max(1_000_000),
    })
    .readonly(),
);

const visibilityKeyframeSchema = keyframe(z.boolean());

const uiKeyframeSchema = keyframe(
  z
    .strictObject({
      opacity: unitSchema,
      translation: cinematicVec3Schema,
      scale: z.number().nonnegative().max(100),
      blur: z.number().nonnegative().max(500),
    })
    .readonly(),
);

const emitterValueSchema = z
  .strictObject({
    rate: z.number().nonnegative().max(100_000),
    lifetimeMs: timeSchema.max(3_600_000),
    velocity: cinematicVec3Schema,
    spread: z.number().min(0).max(360),
  })
  .readonly();

const smokeValueSchema = z
  .strictObject({
    density: unitSchema,
    drift: cinematicVec3Schema,
    size: z.number().nonnegative().max(100_000),
    opacity: unitSchema,
  })
  .readonly();

/** The `progress` of a teleport track at which its flash peaks and the arrival shows. */
export const teleportFlashProgress = 0.42;

/** An arrival by teleport: `progress` runs 0 → 1 over charge, flash and fade. */
const teleportValueSchema = z
  .strictObject({
    position: cinematicVec3Schema,
    progress: unitSchema,
    tint: z
      .strictObject({ x: unitSchema, y: unitSchema, z: unitSchema })
      .readonly(),
  })
  .readonly();

const audioCueKeyframeSchema = keyframe(
  z
    .strictObject({
      asset: referenceSchema,
      cue: referenceSchema,
      gain: unitSchema,
    })
    .readonly(),
);

const trackBase = {
  id: idSchema,
  target: idSchema,
};

export const cinematicClipTrackSchema = z
  .strictObject({
    kind: z.literal("clip"),
    ...trackBase,
    keyframes: z.array(clipKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicTransformTrackSchema = z
  .strictObject({
    kind: z.literal("transform"),
    ...trackBase,
    keyframes: z.array(transformKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicCameraTrackSchema = z
  .strictObject({
    kind: z.literal("camera"),
    ...trackBase,
    keyframes: z.array(cameraKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicLightTrackSchema = z
  .strictObject({
    kind: z.literal("light"),
    ...trackBase,
    keyframes: z.array(lightKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicVisibilityTrackSchema = z
  .strictObject({
    kind: z.literal("visibility"),
    ...trackBase,
    keyframes: z.array(visibilityKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicUiTrackSchema = z
  .strictObject({
    kind: z.literal("ui"),
    ...trackBase,
    keyframes: z.array(uiKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicEmitterTrackSchema = z
  .strictObject({
    kind: z.literal("emitter"),
    ...trackBase,
    seed: z.number().int().min(0).max(0xffff_ffff),
    keyframes: z.array(keyframe(emitterValueSchema)).min(1),
  })
  .readonly();

export const cinematicSmokeTrackSchema = z
  .strictObject({
    kind: z.literal("smoke"),
    ...trackBase,
    seed: z.number().int().min(0).max(0xffff_ffff),
    keyframes: z.array(keyframe(smokeValueSchema)).min(1),
  })
  .readonly();

export const cinematicTeleportTrackSchema = z
  .strictObject({
    kind: z.literal("teleport"),
    ...trackBase,
    keyframes: z.array(keyframe(teleportValueSchema)).min(1),
  })
  .readonly();

export const cinematicAudioTrackSchema = z
  .strictObject({
    kind: z.literal("audio"),
    ...trackBase,
    keyframes: z.array(audioCueKeyframeSchema).min(1),
  })
  .readonly();

export const cinematicTrackSchema = z.discriminatedUnion("kind", [
  cinematicClipTrackSchema,
  cinematicTransformTrackSchema,
  cinematicCameraTrackSchema,
  cinematicLightTrackSchema,
  cinematicVisibilityTrackSchema,
  cinematicUiTrackSchema,
  cinematicEmitterTrackSchema,
  cinematicSmokeTrackSchema,
  cinematicTeleportTrackSchema,
  cinematicAudioTrackSchema,
]);

export const cinematicSceneSchema = z
  .strictObject({
    id: idSchema,
    schemaVersion: z.literal(1),
    durationMs: z.number().positive(),
    loop: z.boolean(),
    declarations: z.array(cinematicDeclarationSchema).min(1),
    markers: z.array(cinematicMarkerSchema).default([]),
    phases: z.array(cinematicPhaseSchema).default([]),
    tracks: z.array(cinematicTrackSchema).min(1),
  })
  .superRefine(checkSceneConstraints)
  .readonly();

export type CinematicVec3 = z.infer<typeof cinematicVec3Schema>;
export type CinematicEasing = z.infer<typeof cinematicEasingSchema>;
export type CinematicKeyframe = z.infer<typeof cinematicKeyframeSchema>;
export type CinematicAssetDeclaration = z.infer<
  typeof cinematicAssetDeclarationSchema
>;
export type CinematicActorDeclaration = z.infer<
  typeof cinematicActorDeclarationSchema
>;
export type CinematicDeclaration = z.infer<typeof cinematicDeclarationSchema>;
export type CinematicMarker = z.infer<typeof cinematicMarkerSchema>;
export type CinematicPhase = z.infer<typeof cinematicPhaseSchema>;
export type CinematicClipTrack = z.infer<typeof cinematicClipTrackSchema>;
export type CinematicTransformTrack = z.infer<
  typeof cinematicTransformTrackSchema
>;
export type CinematicCameraTrack = z.infer<typeof cinematicCameraTrackSchema>;
export type CinematicLightTrack = z.infer<typeof cinematicLightTrackSchema>;
export type CinematicVisibilityTrack = z.infer<
  typeof cinematicVisibilityTrackSchema
>;
export type CinematicUiTrack = z.infer<typeof cinematicUiTrackSchema>;
export type CinematicEmitterTrack = z.infer<typeof cinematicEmitterTrackSchema>;
export type CinematicSmokeTrack = z.infer<typeof cinematicSmokeTrackSchema>;
export type CinematicTeleportTrack = z.infer<
  typeof cinematicTeleportTrackSchema
>;
export type CinematicAudioTrack = z.infer<typeof cinematicAudioTrackSchema>;
export type CinematicTrack = z.infer<typeof cinematicTrackSchema>;
export type CinematicScene = z.infer<typeof cinematicSceneSchema>;
