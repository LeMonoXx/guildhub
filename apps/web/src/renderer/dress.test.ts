import { describe, expect, test } from "vitest";
import { dress } from "./dress";

describe("dress", () => {
  test("places an authored item texture in its body section", () => {
    const dressed = dress(
      {
        geosets: [0, 1001],
        sections: [{ sectionType: 3, x: 2, y: 4, width: 8, height: 16 }],
        sectionLayers: [{ sectionType: 3, textureType: 1, blendMode: 2 }],
      },
      [
        {
          itemId: 7,
          name: "fixture tunic",
          inventoryType: 5,
          equipSlot: 5,
          geosetGroup: [],
          helmHideGeosetGroups: [],
          models: [],
          bodyTextures: [{ section: 3, textures: [{ fileDataId: 99 }] }],
          geosets: [{ group: 10, geoset: 1002 }],
        },
      ],
    );
    expect(dressed.layers).toEqual([
      expect.objectContaining({ fileDataId: 99, layer: 1303 }),
    ]);
    expect(dressed.geosets).toContain(1002);
    expect(dressed.geosets).not.toContain(1001);
  });
});
