import { describe, expect, it } from "vitest";
import { celebrationImage } from "./discord-images.js";

const member = { slug: "ann-example", name: "Ann", classId: "4" };

describe("celebration images", () => {
  it("shows what happened", () => {
    expect([
      celebrationImage({ kind: "levelCap", member, level: 60 }),
      celebrationImage({
        kind: "profession",
        member,
        profession: "Kräuterkunde",
        professionId: 182,
        milestone: 225,
      }),
      celebrationImage({
        kind: "reputation",
        member,
        faction: "Darnassus",
        standing: "Ehrfürchtig",
        tier: 7,
      }),
      celebrationImage({
        kind: "achievement",
        member,
        achievement: "Explore Durotar",
        iconUrl: "/api/icons/236844",
      }),
    ]).toEqual([
      "/api/icons/236567",
      "/api/icons/136246",
      "/api/icons/236688",
      "/api/icons/236844",
    ]);
  });

  it("has no picture for a profession it does not know", () => {
    expect(
      celebrationImage({
        kind: "profession",
        member,
        profession: "Schmiedekunst",
        milestone: 150,
      }),
    ).toBeUndefined();
  });
});
