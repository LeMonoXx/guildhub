import {
  cinematicSceneSchema,
  type CinematicScene,
  type FeaturedMember,
} from "@guildhub/contracts";
import { ActorTrackBuilder } from "./actor-tracks";
import { arrangeTroop } from "./arrange-troop";
import { walkingFootprint } from "./gear-reach";
import { planEntrances, type Entrance } from "./plan-entrances";
import { stageDeclarations, stageTracks } from "./stage-tracks";
import type { TroopPlace } from "./troop-place";
import { walkFlavorFor } from "./walk-flavor";

export { facingToward } from "./stage-motion";

/** Time after the last arrival until everyone has turned and knelt. */
const settleMs = 1800;
/** Idle beats play this long after assembly before the last pose holds. */
const idleTailMs = 12_000;

/** Entrance plan for a lineup, also used by tests and the stage overlay. */
export const planLineupEntrances = (
  places: readonly TroopPlace[],
): Entrance[] =>
  planEntrances(
    places.map((place, index) => ({
      slot: place.slot,
      radius: walkingFootprint(place.member),
      travelMs: walkFlavorFor(index, place.member).travelMs,
    })),
  );

export const lineupAssembledAt = (entrances: readonly Entrance[]): number =>
  Math.max(0, ...entrances.map((entrance) => entrance.settledAt)) + settleMs;

/**
 * The featured troop walks on stage once, turns to the camera and stays.
 * Live interaction takes over from the "hold" phase on.
 */
export const buildLineupScene = (
  members: readonly FeaturedMember[],
): CinematicScene => {
  const places = arrangeTroop(members);
  const entrances = planLineupEntrances(places);
  const assembledAt = lineupAssembledAt(entrances);
  const durationMs = assembledAt + idleTailMs;

  return cinematicSceneSchema.parse({
    id: "guild-lineup",
    schemaVersion: 1,
    durationMs,
    loop: false,
    declarations: [
      ...places.map((place) => ({
        kind: "actor" as const,
        id: place.member.slug,
        manifest: place.member.lookManifest,
        character: place.member.slug,
      })),
      ...stageDeclarations,
    ],
    markers: [
      { id: "enter", timeMs: 0 },
      { id: "assembled", timeMs: assembledAt },
    ],
    phases: [
      { id: "enter", startMs: 0, endMs: assembledAt },
      { id: "hold", startMs: assembledAt, endMs: durationMs },
    ],
    tracks: [
      ...stageTracks(durationMs),
      ...places.flatMap((place, index) => {
        const entrance = entrances[index];
        return entrance === undefined
          ? []
          : new ActorTrackBuilder(
              place,
              walkFlavorFor(index, place.member),
              entrance,
            ).build();
      }),
    ],
  });
};
