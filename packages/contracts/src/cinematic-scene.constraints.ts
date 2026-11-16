import type { z } from "zod";

interface Identified {
  readonly id: string;
}

interface SceneTrack extends Identified {
  readonly kind: string;
  readonly target: string;
  readonly keyframes: readonly { readonly timeMs: number }[];
}

interface SceneShape {
  readonly durationMs: number;
  readonly loop: boolean;
  readonly declarations: readonly Identified[];
  readonly markers: readonly (Identified & { readonly timeMs: number })[];
  readonly phases: readonly (Identified & {
    readonly startMs: number;
    readonly endMs: number;
  })[];
  readonly tracks: readonly SceneTrack[];
}

type Path = (string | number)[];

const issue = (ctx: z.RefinementCtx, message: string, path: Path) => {
  ctx.addIssue({ code: "custom", message, path });
};

function reportDuplicateIds(
  items: readonly Identified[],
  path: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  items.forEach(({ id }, index) => {
    if (seen.has(id))
      issue(ctx, `Duplicate ${path} value: ${id}`, [path, index]);
    seen.add(id);
  });
}

const keyframeValue = (keyframe: unknown) => {
  const { value } = keyframe as { value: unknown };
  return value;
};

/** A looping scene jumps from its end back to 0, so both ends must pose alike. */
function loopedTrackIssue(
  keyframes: readonly { readonly timeMs: number }[],
  durationMs: number,
): string | undefined {
  const first = keyframes[0];
  const last = keyframes.at(-1);
  if (first?.timeMs !== 0 || last?.timeMs !== durationMs)
    return "Looped tracks must span time 0 through durationMs";
  if (
    JSON.stringify(keyframeValue(first)) !== JSON.stringify(keyframeValue(last))
  )
    return "Looped track endpoints must match";
  return undefined;
}

function checkKeyframeTimes(
  track: SceneTrack,
  trackIndex: number,
  scene: SceneShape,
  ctx: z.RefinementCtx,
): void {
  let previousTime = -1;
  track.keyframes.forEach(({ timeMs }, keyframeIndex) => {
    const path = ["tracks", trackIndex, "keyframes", keyframeIndex, "timeMs"];
    if (timeMs > scene.durationMs)
      issue(ctx, "Keyframe timeMs must be within scene duration", path);
    if (timeMs <= previousTime)
      issue(ctx, "Keyframe times must be strictly increasing", path);
    previousTime = timeMs;
  });
}

/** Audio cues fire once per loop; every other track must close the loop. */
function checkLooping(
  track: SceneTrack,
  trackIndex: number,
  scene: SceneShape,
  ctx: z.RefinementCtx,
): void {
  if (!scene.loop) return;
  const path = ["tracks", trackIndex, "keyframes"];
  if (track.kind === "audio") {
    if (track.keyframes.some(({ timeMs }) => timeMs === scene.durationMs))
      issue(ctx, "Looped audio cues must occur before durationMs", path);
    return;
  }
  const loopIssue = loopedTrackIssue(track.keyframes, scene.durationMs);
  if (loopIssue !== undefined) issue(ctx, loopIssue, path);
}

function checkTracks(scene: SceneShape, ctx: z.RefinementCtx): void {
  const declarations = new Set(scene.declarations.map(({ id }) => id));
  const trackTargets = new Set<string>();
  scene.tracks.forEach((track, trackIndex) => {
    const targetPath = ["tracks", trackIndex, "target"];
    const targetKey = `${track.kind}:${track.target}`;
    if (trackTargets.has(targetKey))
      issue(
        ctx,
        `Duplicate ${track.kind} track target: ${track.target}`,
        targetPath,
      );
    trackTargets.add(targetKey);
    if (!declarations.has(track.target))
      issue(ctx, `Unknown track target: ${track.target}`, targetPath);
    checkKeyframeTimes(track, trackIndex, scene, ctx);
    checkLooping(track, trackIndex, scene, ctx);
  });
}

function checkMarkers(scene: SceneShape, ctx: z.RefinementCtx): void {
  let previousTime = -1;
  scene.markers.forEach(({ timeMs }, index) => {
    const path = ["markers", index, "timeMs"];
    const beyondEnd =
      timeMs > scene.durationMs || (scene.loop && timeMs === scene.durationMs);
    if (beyondEnd)
      issue(ctx, "Marker timeMs must be within the playable timeline", path);
    if (timeMs <= previousTime)
      issue(ctx, "Markers must be strictly ordered by timeMs", path);
    previousTime = timeMs;
  });
}

function checkPhases(scene: SceneShape, ctx: z.RefinementCtx): void {
  let previousStart = -1;
  let previousEnd = -1;
  scene.phases.forEach((phase, index) => {
    if (phase.endMs > scene.durationMs)
      issue(ctx, "Phase endMs must be within scene duration", [
        "phases",
        index,
        "endMs",
      ]);
    const startPath = ["phases", index, "startMs"];
    if (index > 0 && phase.startMs <= previousStart)
      issue(
        ctx,
        "Phase startMs values must be strictly ordered and unique",
        startPath,
      );
    if (index > 0 && phase.startMs < previousEnd)
      issue(ctx, "Phases must not overlap", startPath);
    previousStart = phase.startMs;
    previousEnd = phase.endMs;
  });
}

/** Cross-field rules the per-field schemas cannot express. */
export function checkSceneConstraints(
  scene: SceneShape,
  ctx: z.RefinementCtx,
): void {
  reportDuplicateIds(scene.declarations, "declarations", ctx);
  reportDuplicateIds(scene.markers, "markers", ctx);
  reportDuplicateIds(scene.phases, "phases", ctx);
  reportDuplicateIds(scene.tracks, "tracks", ctx);
  checkTracks(scene, ctx);
  checkMarkers(scene, ctx);
  checkPhases(scene, ctx);
}
