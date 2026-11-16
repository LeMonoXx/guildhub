import { describe, expect, test } from "vitest";
import { itemDisplayModels } from "./item-models";
import type { ResolvedItem } from "./types";

const item = (patch: Partial<ResolvedItem>): ResolvedItem =>
  ({
    itemId: 1,
    name: "Blade",
    inventoryType: null,
    equipSlot: 16,
    geosetGroup: [],
    helmHideGeosetGroups: [],
    models: [],
    bodyTextures: [],
    ...patch,
  }) as ResolvedItem;

describe("itemDisplayModels", () => {
  test("keeps a weapon mesh and skips a second copy of the same file", () => {
    expect(
      itemDisplayModels(
        item({
          attachments: [
            {
              slot: 16,
              attachmentId: 1,
              modelFileDataId: 50,
              textureFileDataId: 9,
            },
          ],
          models: [{ slot: 16, models: [{ fileDataId: 50 }], textures: [] }],
        }),
      ),
    ).toEqual([{ fileDataId: 50, textureFileDataId: 9 }]);
  });

  test("a chest painted on the body has no mesh of its own", () => {
    expect(
      itemDisplayModels(
        item({
          bodyTextures: [{ section: 3, textures: [{ fileDataId: 4 }] }],
        }),
      ),
    ).toEqual([]);
  });
});
