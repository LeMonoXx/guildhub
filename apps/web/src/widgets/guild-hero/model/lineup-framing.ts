import {
  mapCommands,
  type CinematicFrame,
  type FrameDecorator,
} from "../../../shared/cinematic";
import {
  lineupCamera,
  lineupScale,
  StageProjection,
  type CameraPose,
  type Pose,
} from "./stage-view";
import { silhouetteOf, type TroopPlace } from "./troop-place";

/** Where the assembled troop may reach on the stage, as fractions of it. */
export const framingBounds = {
  /** Highest head; leaves room for the floating header. */
  top: 0.12,
  /** Front-row feet; the floor below fades into the page. */
  feet: 0.85,
  /** Outermost shoulders. */
  side: 0.06,
} as const;

const fovRange = { min: 14, max: 95 } as const;
const eyeRange = { min: -2, max: 12 } as const;
const solveSteps = 32;
const aimDrop = lineupCamera.position.y - lineupCamera.target.y;
/** Hair, horns and shoulder pads rise above the race's body height. */
const crownReach = 1.14;

const cameraAt = (fov: number, eyeY: number): CameraPose => ({
  position: { ...lineupCamera.position, y: eyeY },
  target: { ...lineupCamera.target, y: eyeY - aimDrop },
  fov,
});

interface Reach {
  readonly heads: readonly Pose[];
  readonly feet: readonly Pose[];
  readonly sides: readonly Pose[];
}

const reachOf = (places: readonly TroopPlace[]): Reach => {
  const bodies = places.map(silhouetteOf);
  return {
    heads: bodies.map(({ slot, height }) => ({
      ...slot,
      y: height * lineupScale * crownReach,
    })),
    feet: bodies.map(({ slot }) => slot),
    sides: bodies.flatMap(({ slot, halfWidth, height }) => {
      const y = (height * lineupScale) / 2;
      const reach = halfWidth * lineupScale;
      return [
        { ...slot, x: slot.x - reach, y },
        { ...slot, x: slot.x + reach, y },
      ];
    }),
  };
};

const bisect = (
  low: number,
  high: number,
  isHighEnough: (value: number) => boolean,
): number => {
  let [below, above] = [low, high];
  for (let step = 0; step < solveSteps; step += 1) {
    const middle = (below + above) / 2;
    if (isHighEnough(middle)) above = middle;
    else below = middle;
  }
  return above;
};

/** Camera height that puts the lowest front-row feet on the floor line. */
const eyeFor = (fov: number, aspect: number, feet: readonly Pose[]): number =>
  bisect(eyeRange.min, eyeRange.max, (eyeY) => {
    const projection = new StageProjection(aspect, cameraAt(fov, eyeY));
    const lowest = Math.max(...feet.map((foot) => projection.point(foot).y));
    return lowest >= framingBounds.feet;
  });

const fits = (projection: StageProjection, reach: Reach): boolean =>
  reach.heads.every((head) => projection.point(head).y >= framingBounds.top) &&
  reach.sides.every((side) => {
    const { x } = projection.point(side);
    return x >= framingBounds.side && x <= 1 - framingBounds.side;
  });

/**
 * The narrowest camera that still shows the whole troop: the stage's shape
 * decides whether the heads or the outer shoulders bound it, so wide screens
 * get big figures and tall ones still see everybody.
 */
export const frameLineup = (
  places: readonly TroopPlace[],
  aspect: number,
): CameraPose => {
  if (places.length === 0 || !(aspect > 0)) return lineupCamera;
  const reach = reachOf(places);
  const fov = bisect(fovRange.min, fovRange.max, (candidate) =>
    fits(
      new StageProjection(
        aspect,
        cameraAt(candidate, eyeFor(candidate, aspect, reach.feet)),
      ),
      reach,
    ),
  );
  return cameraAt(fov, eyeFor(fov, aspect, reach.feet));
};

/** Rounds the aspect so a resize settles on one camera instead of jittering. */
const aspectKey = (aspect: number) => Math.round(aspect * 100) / 100;

/** Replaces the authored camera with one framed for the stage's current shape. */
export class LineupFraming implements FrameDecorator {
  private aspect = 16 / 9;
  private framed: CameraPose;

  constructor(private readonly places: readonly TroopPlace[]) {
    this.framed = frameLineup(places, this.aspect);
  }

  get camera(): CameraPose {
    return this.framed;
  }

  /** Returns the camera for `aspect`; the next frame uses it too. */
  frameFor(aspect: number): CameraPose {
    const key = aspectKey(aspect);
    if (key > 0 && key !== this.aspect) {
      this.aspect = key;
      this.framed = frameLineup(this.places, key);
    }
    return this.framed;
  }

  decorate(frame: CinematicFrame): CinematicFrame {
    return mapCommands(frame, (command) =>
      command.kind === "camera"
        ? { ...command, value: { ...this.framed } }
        : command,
    );
  }
}
