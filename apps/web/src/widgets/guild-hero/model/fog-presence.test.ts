import { afterEach, describe, expect, test } from "vitest";
import type { CinematicFrame } from "../../../cinematic";
import { createFixtureGuildSource } from "../../../entities/guild";
import {
  clearFogFigures,
  readFogFigures,
} from "../../../shared/lib/fog-channel";
import { arrangeTroop } from "./arrange-troop";
import { FogPresence } from "./fog-presence";
import { lineupCamera } from "./stage-view";

const stageAt = (left: number, top: number, width: number, height: number) =>
  ({
    getBoundingClientRect: () => ({ left, top, width, height }),
  }) as unknown as HTMLElement;

const frameWith = (commands: CinematicFrame["commands"]): CinematicFrame => ({
  timeMs: 0,
  elapsedMs: 0,
  iteration: 0,
  atEnd: false,
  phase: { id: "hold" } as CinematicFrame["phase"],
  commands,
  audioCues: [],
});

afterEach(() => {
  clearFogFigures();
});

describe("FogPresence", () => {
  test("reports each member's body on screen and leaves the frame alone", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members.slice(0, 2));
    const [first] = places;
    if (!first) throw new Error("need a place");
    const presence = new FogPresence(places, () => stageAt(100, 50, 1200, 800));
    const frame = frameWith([
      {
        kind: "camera",
        trackId: "camera",
        target: "camera",
        value: lineupCamera,
      },
      {
        kind: "transform",
        trackId: `${first.member.slug}-transform`,
        target: first.member.slug,
        value: { position: first.slot, rotation: { x: 0, y: 0, z: 0 } },
      },
      { kind: "transform", trackId: "x", target: "not-a-member", value: {} },
    ]);

    expect(presence.decorate(frame)).toBe(frame);

    const [figure, ...rest] = readFogFigures();
    expect(rest).toHaveLength(0);
    expect(figure?.id).toBe(first.member.slug);
    expect(figure?.x).toBeGreaterThan(100);
    expect(figure?.x).toBeLessThan(1300);
    expect(figure?.head).toBeLessThan(figure?.feet ?? 0);
    expect(figure?.halfWidth).toBeGreaterThan(0);
  });

  test("reports nothing without a stage element", () => {
    const presence = new FogPresence([], () => null);
    presence.decorate(frameWith([]));
    expect(readFogFigures()).toHaveLength(0);
  });
});
