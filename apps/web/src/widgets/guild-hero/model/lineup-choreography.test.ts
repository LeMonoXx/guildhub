import { describe, expect, test } from "vitest";

import { CinematicTimeline, type CinematicFrame } from "../../../cinematic";
import { createFixtureGuildSource } from "../../../entities/guild";
import { arrangeTroop } from "./arrange-troop";
import { buildLineupScene } from "./build-lineup-scene";
import { LineupChoreography } from "./lineup-choreography";
import type { ActorTransform } from "./stage-motion";

const setup = async () => {
  const members = (
    await createFixtureGuildSource().getFeaturedMembers()
  ).members.slice(0, 6);
  const timeline = new CinematicTimeline(buildLineupScene(members));
  const places = arrangeTroop(members);
  return { timeline, places, choreography: new LineupChoreography(places) };
};

const transformOf = (frame: CinematicFrame, slug: string) =>
  frame.commands.find(
    (command) => command.kind === "transform" && command.target === slug,
  )?.value as ActorTransform | undefined;

const clipOf = (frame: CinematicFrame, slug: string) =>
  frame.commands.find(
    (command) => command.kind === "clip" && command.target === slug,
  )?.value as { readonly animationGroup: string } | undefined;

describe("LineupChoreography", () => {
  test("leaves the entrance alone and reports when the lineup has assembled", async () => {
    const { timeline, choreography } = await setup();
    const entering = timeline.evaluate(500);
    expect(choreography.decorate(entering)).toBe(entering);
    expect(choreography.isAssembled).toBe(false);

    let told = 0;
    choreography.subscribe(() => (told += 1));
    choreography.decorate(timeline.evaluate(timeline.scene.durationMs));
    expect(choreography.isAssembled).toBe(true);
    expect(told).toBe(1);
  });

  test("walks the selected member to the front and stands it facing the camera", async () => {
    const { timeline, places, choreography } = await setup();
    const chosen = places[0];
    if (!chosen) throw new Error("need a member");
    const end = timeline.scene.durationMs;
    const slug = chosen.member.slug;

    choreography.decorate(timeline.evaluate(end));
    choreography.select(slug);
    const spot = choreography.planFor(slug).targetOf(slug);

    choreography.decorate(timeline.evaluate(end + 16));
    const walking = choreography.decorate(timeline.evaluate(end + 900));
    expect(clipOf(walking, slug)?.animationGroup).toBe("Walk");

    const arrived = choreography.decorate(timeline.evaluate(end + 8000));
    const transform = transformOf(arrived, slug);
    expect(transform?.position.x).toBeCloseTo(spot.x);
    expect(transform?.position.z).toBeCloseTo(spot.z);
    expect(transform?.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(clipOf(arrived, slug)?.animationGroup).not.toBe("Walk");
  });

  test("rapid picks never leave two members out front", async () => {
    const { timeline, places, choreography } = await setup();
    const [first, second] = places;
    if (!first || !second) throw new Error("need two members");
    const end = timeline.scene.durationMs;
    const homeZ = Math.max(...places.map((place) => place.slot.z));

    choreography.decorate(timeline.evaluate(end));
    const picks = [first, second, first, second, first];
    picks.forEach((pick, index) => {
      choreography.select(pick.member.slug);
      choreography.decorate(timeline.evaluate(end + 16 + index * 90));
    });

    const settled = choreography.decorate(timeline.evaluate(end + 12_000));
    const outFront = places.filter(
      (place) =>
        (transformOf(settled, place.member.slug)?.position.z ?? 0) >
        homeZ + 0.2,
    );
    expect(outFront.map((place) => place.member.slug)).toEqual([
      first.member.slug,
    ]);
  });

  test("hands everyone back to the scene once they are home again", async () => {
    const { timeline, places, choreography } = await setup();
    const chosen = places[0];
    if (!chosen) throw new Error("need a member");
    const end = timeline.scene.durationMs;

    choreography.decorate(timeline.evaluate(end));
    choreography.select(chosen.member.slug);
    choreography.decorate(timeline.evaluate(end + 16));
    choreography.decorate(timeline.evaluate(end + 8000));
    choreography.select(undefined);
    choreography.decorate(timeline.evaluate(end + 8016));

    const home = timeline.evaluate(end + 16000);
    expect(choreography.decorate(home)).toBe(home);
  });
});
