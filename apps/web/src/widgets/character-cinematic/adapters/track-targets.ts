import type { CinematicScene, CinematicTrack } from "@guildhub/contracts";
import type { CharacterHandle } from "../../character-model";
import {
  AudioBindingState,
  BindingTargetRegistry,
  type UiBindingTarget,
} from "./bindings";
import { SmokeEffect } from "./smoke-effect";
import type { StageRig } from "./stage-rig";
import { TeleportEffect } from "./teleport-effect";

export interface TrackTargetSources {
  readonly scene: CinematicScene;
  readonly actors: ReadonlyMap<string, CharacterHandle>;
  readonly rig: StageRig;
  readonly uiTarget: UiBindingTarget;
  /** Receives every effect created for a track; the caller disposes them. */
  readonly effects: { dispose(): void }[];
}

type Installer = (
  track: CinematicTrack,
  sources: TrackTargetSources,
) => unknown;

const hashTrackId = (id: string): number => {
  let hash = 0x811c9dc5;
  for (const char of id)
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
};

/** A light track may name a scene asset whose value is the rig's light name. */
function lightFor(track: CinematicTrack, sources: TrackTargetSources) {
  const declaration = sources.scene.declarations.find(
    ({ id }) => id === track.target,
  );
  const lightName =
    declaration?.kind === "asset" ? declaration.asset : track.target;
  return sources.rig.lights.get(lightName);
}

function smokeFor(track: CinematicTrack, sources: TrackTargetSources) {
  const { seed } = track as Extract<CinematicTrack, { kind: "smoke" }>;
  const smoke = new SmokeEffect(seed);
  sources.effects.push(smoke);
  sources.rig.effectRoot.add(smoke.points);
  return smoke;
}

function teleportFor(track: CinematicTrack, sources: TrackTargetSources) {
  const teleport = new TeleportEffect(hashTrackId(track.id));
  sources.effects.push(teleport);
  sources.rig.effectRoot.add(teleport.root);
  return teleport;
}

const installers = new Map<string, Installer>([
  ["clip", (track, { actors }) => actors.get(track.target)],
  ["transform", (track, { actors }) => actors.get(track.target)?.root],
  ["visibility", (track, { actors }) => actors.get(track.target)?.root],
  ["camera", (_track, { rig }) => rig],
  ["light", lightFor],
  ["ui", (_track, { uiTarget }) => uiTarget],
  ["smoke", smokeFor],
  ["teleport", teleportFor],
  ["audio", () => new AudioBindingState()],
]);

/** Resolves each track's target once, so playback only looks them up. */
export function registerTrackTargets(
  sources: TrackTargetSources,
): BindingTargetRegistry {
  const targets = new BindingTargetRegistry();
  for (const track of sources.scene.tracks) {
    const target = installers.get(track.kind)?.(track, sources);
    if (target !== undefined)
      targets.register(track.kind, track.target, target);
  }
  return targets;
}
