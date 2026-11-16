import { describe, expect, test } from "vitest";
import type { ResolvedItem } from "./types";
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

  test("keeps one item per hand and stows the displaced weapon by sheathe type", () => {
    const weapon = (
      itemId: number,
      equipSlot: number,
      attachmentId: number,
      sheatheType: number,
    ): ResolvedItem => ({
      itemId,
      name: `weapon ${String(itemId)}`,
      inventoryType: 13,
      equipSlot,
      geosetGroup: [],
      helmHideGeosetGroups: [],
      models: [],
      bodyTextures: [],
      sheatheType,
      attachments: [
        {
          slot: equipSlot,
          attachmentId,
          modelFileDataId: itemId,
          textureFileDataId: null,
        },
      ],
    });
    const look = { geosets: [], sections: [], sectionLayers: [] };

    const ranged = dress(look, [weapon(3, 18, 1, 0), weapon(1, 16, 1, 3)]);
    expect(ranged.attachments).toEqual([
      expect.objectContaining({ itemId: 1, attachmentId: 1 }),
    ]);
    expect(ranged.notes).toContain("item 3 stays stowed: hand 1 is in use");

    const stowed = dress(look, [weapon(1, 16, 1, 3), weapon(2, 18, 1, 2)]);
    expect(stowed.attachments).toEqual([
      expect.objectContaining({ itemId: 1, attachmentId: 1 }),
      expect.objectContaining({ itemId: 2, attachmentId: 26 }),
    ]);

    const wandOnly = dress(look, [weapon(3, 18, 1, 0)]);
    expect(wandOnly.attachments).toEqual([
      expect.objectContaining({ itemId: 3, attachmentId: 1 }),
    ]);
  });

  test("lets a robe skirt win over the trousers of the legs item", () => {
    const garment = (
      itemId: number,
      equipSlot: number,
      geoset: number,
    ): ResolvedItem => ({
      itemId,
      name: `garment ${String(itemId)}`,
      inventoryType: equipSlot === 5 ? 20 : 7,
      equipSlot,
      geosetGroup: [],
      helmHideGeosetGroups: [],
      models: [],
      bodyTextures: [],
      geosets: [{ group: 13, geoset }],
    });
    const look = { geosets: [1301], sections: [], sectionLayers: [] };

    const robed = dress(look, [garment(1, 5, 1302), garment(2, 7, 1301)]);
    expect(robed.geosets).toContain(1302);
    expect(robed.geosets).not.toContain(1301);

    const trousers = dress(look, [garment(1, 5, 1301), garment(2, 7, 1301)]);
    expect(trousers.geosets).toContain(1301);
  });
});
