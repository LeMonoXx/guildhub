import { describe, expect, test } from "vitest";

import type { CinematicFrame } from "../../../shared/cinematic";
import { createFixtureGuildSource } from "../../../entities/guild/testing";
import { arrangeTroop } from "./arrange-troop";
import { frameLineup, framingBounds, LineupFraming } from "./lineup-framing";
import { StageProjection } from "./stage-view";
import { silhouetteOf } from "./troop-place";

const loadPlaces = async () =>
  arrangeTroop(
    (await createFixtureGuildSource().getFeaturedMembers()).members.slice(0, 6),
  );

const aspects = [0.6, 1, 16 / 9, 2.4, 3.6];
const tolerance = 0.01;

describe("lineup framing", () => {
  test.each(aspects)(
    "shows the whole troop with feet on the floor line at aspect %d",
    async (aspect) => {
      const places = await loadPlaces();
      const projection = new StageProjection(
        aspect,
        frameLineup(places, aspect),
      );
      const boxes = places.map((place) => projection.box(silhouetteOf(place)));
      const highest = Math.min(...boxes.map((box) => box.top));
      const lowest = Math.max(...boxes.map((box) => box.top + box.height));
      expect(highest).toBeGreaterThanOrEqual(framingBounds.top - tolerance);
      expect(lowest).toBeCloseTo(framingBounds.feet, 2);
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(framingBounds.side - tolerance);
        expect(box.left + box.width).toBeLessThanOrEqual(
          1 - framingBounds.side + tolerance,
        );
      }
    },
  );

  test("draws the troop larger on a wide stage than on a tall one", async () => {
    const places = await loadPlaces();
    expect(frameLineup(places, 2.4).fov).toBeLessThan(
      frameLineup(places, 0.8).fov,
    );
  });

  test("swaps the authored camera for the framed one", async () => {
    const places = await loadPlaces();
    const framing = new LineupFraming(places);
    const camera = framing.frameFor(2.2);
    const frame = {
      commands: [
        {
          kind: "camera",
          trackId: "lineup-camera",
          target: "camera",
          value: { position: { x: 0, y: 0, z: 0 }, target: {}, fov: 1 },
        },
        { kind: "clip", trackId: "walk", target: "someone", value: "Walk" },
      ],
    } as unknown as CinematicFrame;
    const [cameraCommand, clipCommand] = framing.decorate(frame).commands;
    expect(cameraCommand?.value).toEqual(camera);
    expect(clipCommand?.value).toBe("Walk");
  });
});
