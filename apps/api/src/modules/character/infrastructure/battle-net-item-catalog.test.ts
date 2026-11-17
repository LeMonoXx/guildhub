import { describe, expect, it } from "vitest";
import { mapItemDocument } from "./battle-net-item-catalog.js";

const document = {
  id: 2582,
  name: "Green Woolen Leggings",
  quality: { type: "UNCOMMON", name: "Uncommon" },
  level: 18,
  inventory_type: { type: "LEGS", name: "Legs" },
  preview_item: {
    item: { id: 2582 },
    name: "Green Woolen Leggings",
    quality: { type: "UNCOMMON", name: "Uncommon" },
    item_class: { name: "Armor" },
    item_subclass: { name: "Cloth" },
    inventory_type: { type: "LEGS", name: "Legs" },
    binding: { type: "ON_EQUIP", name: "Binds when equipped" },
    armor: { value: 21, display: { display_string: "21 Armor" } },
    stats: [
      {
        type: { type: "STAMINA", name: "Stamina" },
        value: 3,
        display: {
          display_string: "+3 Stamina",
          color: { r: 255, g: 255, b: 255, a: 1 },
        },
      },
    ],
    sell_price: { value: 412 },
    requirements: { level: { value: 13 } },
  },
};

describe("mapItemDocument", () => {
  it("reads the preview as the tooltip, with the inventory type as the slot", () => {
    expect(mapItemDocument(document)).toMatchObject({
      itemId: 2582,
      slot: "LEGS",
      slotName: "Legs",
      name: "Green Woolen Leggings",
      quality: "UNCOMMON",
      itemLevel: 18,
      requiredLevel: 13,
      binding: "Binds when equipped",
      itemSubclass: "Cloth",
      armor: "21 Armor",
      stats: [{ type: "STAMINA", label: "+3 Stamina" }],
      sellPriceCopper: 412,
    });
  });

  it("prefers the preview's own item level", () => {
    const preview = { ...document.preview_item, level: { value: 20 } };
    expect(
      mapItemDocument({ ...document, preview_item: preview })?.itemLevel,
    ).toBe(20);
  });

  it("returns nothing for a document without a preview", () => {
    expect(mapItemDocument({ id: 1 })).toBeUndefined();
  });
});
