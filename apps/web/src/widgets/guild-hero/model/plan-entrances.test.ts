import { describe, expect, test } from "vitest";
import type { FeaturedMember } from "@guildhub/contracts";
import { createFixtureGuildSource } from "../../../entities/guild";
import { raceRadius } from "../../../entities/character";
import { arrangeTroop, maxCoverage, silhouetteOf } from "./arrange-troop";
import { planLineupEntrances } from "./build-lineup-scene";
import { planEntrances } from "./plan-entrances";
import { coverage } from "./stage-view";

const raceIds = ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11"];

const lineups = (base: FeaturedMember, count: number): FeaturedMember[][] => {
  const result: FeaturedMember[][] = [];
  let state = 7;
  for (let lineup = 0; lineup < count; lineup += 1) {
    const size = 2 + (lineup % 5);
    result.push(
      Array.from({ length: size }, (_, index) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0;
        return {
          ...base,
          raceId: raceIds[state % raceIds.length] ?? "1",
          slug: `actor-${String(lineup)}-${String(index)}`,
        };
      }),
    );
  }
  return [
    ...result,
    ["6", "8", "4", "11", "7", "3"].map((raceId, index) => ({
      ...base,
      raceId,
      slug: `live-like-${String(index)}`,
    })),
  ];
};

const easeOut = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 2;

const loadBase = async () => {
  const [base] = (await createFixtureGuildSource().getFeaturedMembers())
    .members;
  if (!base) throw new Error("need a featured member");
  return base;
};

describe("troop occlusion and entrances", () => {
  test("nobody hides more than the allowed share of anyone behind", async () => {
    const base = await loadBase();
    for (const members of lineups(base, 60)) {
      const places = arrangeTroop(members);
      for (const front of places) {
        for (const behind of places) {
          if (front === behind) continue;
          expect(
            coverage(silhouetteOf(front), silhouetteOf(behind)),
          ).toBeLessThanOrEqual(maxCoverage + 0.005);
        }
      }
    }
  });

  test("gives every actor its own slot and spawn point", async () => {
    const base = await loadBase();
    for (const members of lineups(base, 60)) {
      const places = arrangeTroop(members);
      const entrances = planLineupEntrances(places);
      for (let a = 0; a < places.length; a += 1) {
        for (let b = a + 1; b < places.length; b += 1) {
          const left = places[a];
          const right = places[b];
          const leftStart = entrances[a]?.start;
          const rightStart = entrances[b]?.start;
          if (!left || !right || !leftStart || !rightStart) continue;
          expect(
            Math.hypot(left.slot.x - right.slot.x, left.slot.z - right.slot.z),
          ).toBeGreaterThan(0.3);
          expect(
            Math.hypot(leftStart.x - rightStart.x, leftStart.z - rightStart.z),
          ).toBeGreaterThan(0.3);
        }
      }
    }
  });

  test("nobody walks through anyone else on the way in", async () => {
    const base = await loadBase();
    for (const members of lineups(base, 60)) {
      const places = arrangeTroop(members);
      const entrances = planLineupEntrances(places);
      const travel = entrances.map(
        (entrance) => entrance.settledAt - entrance.enterAt,
      );
      const at = (index: number, time: number) => {
        const entrance = entrances[index];
        const place = places[index];
        if (!entrance || !place || time < entrance.enterAt) return undefined;
        const t = easeOut((time - entrance.enterAt) / (travel[index] ?? 1));
        return {
          x: entrance.start.x + (place.slot.x - entrance.start.x) * t,
          z: entrance.start.z + (place.slot.z - entrance.start.z) * t,
        };
      };
      const end = Math.max(...entrances.map((entrance) => entrance.settledAt));
      for (let time = 0; time <= end; time += 25) {
        for (let a = 0; a < places.length; a += 1) {
          for (let b = a + 1; b < places.length; b += 1) {
            const left = at(a, time);
            const right = at(b, time);
            const leftPlace = places[a];
            const rightPlace = places[b];
            if (!left || !right || !leftPlace || !rightPlace) continue;
            const planned = Math.hypot(
              leftPlace.slot.x - rightPlace.slot.x,
              leftPlace.slot.z - rightPlace.slot.z,
            );
            const allowed = Math.min(
              (raceRadius(leftPlace.member.raceId) +
                raceRadius(rightPlace.member.raceId)) *
                0.85,
              planned * 0.95,
            );
            expect(
              Math.hypot(left.x - right.x, left.z - right.z),
            ).toBeGreaterThan(allowed);
          }
        }
      }
    }
  });

  test("lets the one in front go first when both share an entry line", () => {
    const back = { slot: { x: 0, y: 0, z: 0 }, radius: 0.6, travelMs: 5000 };
    const front = { slot: { x: 0, y: 0, z: 1.2 }, radius: 0.4, travelMs: 5000 };
    const left = { slot: { x: -2, y: 0, z: 0 }, radius: 0.5, travelMs: 5000 };
    const right = { slot: { x: 2, y: 0, z: 0 }, radius: 0.5, travelMs: 5000 };
    const [planBack, planFront] = planEntrances([back, front, left, right]);
    expect(planBack?.side).toBe("back");
    expect(planFront?.side).toBe("back");
    expect(planFront?.enterAt).toBeLessThan(planBack?.enterAt ?? 0);
  });
});
