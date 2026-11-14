import type { FeaturedMember } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";

import { createFixtureGuildSource } from "../../../entities/guild";
import { arrangeTroop } from "./arrange-troop";
import { standingFootprint, walkingFootprint } from "./gear-reach";
import { HomePlan, StepForwardPlan } from "./stage-plan";
import { StageProjection, type Pose } from "./stage-view";

const raceIds = ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11"];

const loadBase = async () => {
  const [base] = (await createFixtureGuildSource().getFeaturedMembers())
    .members;
  if (!base) throw new Error("need a featured member");
  return base;
};

const lineups = (base: FeaturedMember): FeaturedMember[][] =>
  Array.from({ length: 24 }, (_, lineup) =>
    Array.from({ length: 2 + (lineup % 5) }, (_, index) => ({
      ...base,
      raceId: raceIds[(lineup * 7 + index * 3) % raceIds.length] ?? "1",
      slug: `actor-${String(lineup)}-${String(index)}`,
    })),
  );

const distanceToWalk = (from: Pose, to: Pose, point: Pose) => {
  const vx = to.x - from.x;
  const vz = to.z - from.z;
  const t = Math.min(
    Math.max(
      ((point.x - from.x) * vx + (point.z - from.z) * vz) / (vx * vx + vz * vz),
      0,
    ),
    1,
  );
  return Math.hypot(point.x - (from.x + vx * t), point.z - (from.z + vz * t));
};

describe("StageProjection", () => {
  test("puts the stage center in the middle and nearer bodies lower and larger", () => {
    const projection = new StageProjection(16 / 9);
    const target = projection.point({ x: 0, y: 1.12, z: 0.4 });
    expect(target.x).toBeCloseTo(0.5);
    expect(target.y).toBeCloseTo(0.5);
    const far = projection.box({
      slot: { x: 0, y: 0, z: -1 },
      halfWidth: 0.3,
      height: 1.8,
    });
    const near = projection.box({
      slot: { x: 0, y: 0, z: 1 },
      halfWidth: 0.3,
      height: 1.8,
    });
    expect(near.height).toBeGreaterThan(far.height);
    expect(near.top + near.height).toBeGreaterThan(far.top + far.height);
  });
});

describe("stage plans", () => {
  test("the chosen member ends in front of everyone else", async () => {
    const base = await loadBase();
    for (const cast of lineups(base)) {
      const places = arrangeTroop(cast);
      for (const chosen of places) {
        const plan = new StepForwardPlan(places, chosen.member.slug);
        const spot = plan.targetOf(chosen.member.slug);
        for (const other of places.filter((place) => place !== chosen))
          expect(spot.z).toBeGreaterThan(plan.targetOf(other.member.slug).z);
      }
    }
  });

  test("nobody stands on the chosen member's walk to the front", async () => {
    const base = await loadBase();
    for (const cast of lineups(base)) {
      const places = arrangeTroop(cast);
      for (const chosen of places) {
        const plan = new StepForwardPlan(places, chosen.member.slug);
        const spot = plan.targetOf(chosen.member.slug);
        for (const other of places.filter((place) => place !== chosen)) {
          const clearance =
            walkingFootprint(chosen.member) + standingFootprint(other.member);
          expect(
            distanceToWalk(chosen.slot, spot, plan.targetOf(other.member.slug)),
          ).toBeGreaterThanOrEqual(clearance - 1e-6);
        }
      }
    }
  });

  test("those making way step sideways and start before the chosen one", async () => {
    const base = await loadBase();
    const places = arrangeTroop(
      ["6", "8", "4", "11", "7", "3"].map((raceId, index) => ({
        ...base,
        raceId,
        slug: `live-like-${String(index)}`,
      })),
    );
    const back = places.reduce((deepest, place) =>
      place.slot.z < deepest.slot.z ? place : deepest,
    );
    const plan = new StepForwardPlan(places, back.member.slug);
    expect(plan.yielding.length).toBeGreaterThan(0);
    for (const slug of plan.yielding) {
      const home = places.find((place) => place.member.slug === slug)?.slot;
      expect(plan.targetOf(slug).z).toBe(home?.z);
      expect(plan.startDelayOf(slug)).toBe(0);
    }
    expect(plan.startDelayOf(back.member.slug)).toBeGreaterThan(0);
  });

  test("going home, the one who stepped forward leaves first", async () => {
    const base = await loadBase();
    const places = arrangeTroop([base, { ...base, slug: "second" }]);
    const plan = new HomePlan(places, "second");
    expect(plan.startDelayOf("second")).toBe(0);
    expect(plan.startDelayOf(base.slug)).toBeGreaterThan(0);
    for (const place of places)
      expect(plan.targetOf(place.member.slug)).toBe(place.slot);
  });
});
