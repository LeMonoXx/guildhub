import { describe, expect, test } from "vitest";
import { createFixtureGuildSource } from "../../../entities/guild/testing";
import {
  busiestContinent,
  cameraOn,
  memberTokens,
  placeArea,
  spread,
  zoneIndex,
} from "./map-layout";

const source = createFixtureGuildSource();

describe("map layout", () => {
  test("places areas in their zone and dungeon areas at the entrance", async () => {
    const [atlas, party] = await Promise.all([
      source.getWorldMap(),
      source.getParty(),
    ]);
    const index = zoneIndex(atlas);

    const barrens = placeArea(index, party.dungeons, {
      area: "The Barrens",
      areaId: 380,
    });
    expect(barrens?.zone.name).toBe("The Barrens");
    expect(barrens?.point.x).toBeCloseTo(0.53);

    const keep = placeArea(index, party.dungeons, {
      area: "Shadowfang Keep",
      areaId: 209,
    });
    expect(keep?.dungeon?.key).toBe("shadowfangKeep");
    expect(keep?.continent.name).toBe("Eastern Kingdoms");
    expect(keep?.point.x).toBeCloseTo(0.357 + 0.45 * 0.119);

    expect(placeArea(index, [], { area: "the barrens" })?.zone.uiMapId).toBe(
      1413,
    );
  });

  test("fans out members who stand in the same place", async () => {
    const [atlas, party] = await Promise.all([
      source.getWorldMap(),
      source.getParty(),
    ]);
    const tokens = memberTokens(zoneIndex(atlas), party);

    expect(tokens.map((token) => token.slug)).toEqual([
      "brightforge",
      "shade",
      "lumen",
    ]);
    expect(
      new Set(tokens.map((t) => `${String(t.point.x)}:${String(t.point.y)}`))
        .size,
    ).toBe(3);
    expect(busiestContinent(atlas, tokens)?.name).toBe("Kalimdor");
  });

  test("puts a lone token in the middle", () => {
    expect(spread(0, 1, 0.1)).toEqual({ x: 0, y: 0 });
    expect(spread(0, 3, 0.1)).toEqual({ x: 0, y: 0 });
  });

  test("centers the camera on a zone", () => {
    const camera = cameraOn(
      {
        uiMapId: 1,
        name: "Zone",
        areaIds: [],
        rect: { left: 0.4, top: 0.4, right: 0.6, bottom: 0.6 },
        image: null,
      },
      1,
    );
    expect(camera.scale).toBeCloseTo(5);
    expect(camera.x).toBeCloseTo(-200);
    expect(camera.y).toBeCloseTo(-200);
  });
});
