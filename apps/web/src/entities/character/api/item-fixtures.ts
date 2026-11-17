import { equippedItemSchema, type EquippedItem } from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";

export const fixtureItem = (itemId: number): EquippedItem =>
  parseContract(equippedItemSchema, {
    slot: "HEAD",
    slotName: "Head",
    itemId,
    name: "Helm of Wrath",
    quality: "EPIC",
    qualityName: "Epic",
    itemLevel: 76,
    requiredLevel: 60,
    binding: "Binds when picked up",
    itemClass: "Armor",
    itemSubclass: "Plate",
    inventoryType: "Head",
    armor: "735 Armor",
    stats: [
      {
        type: "STAMINA",
        label: "+40 Stamina",
        value: 40,
        equipBonus: false,
        color: "#ffffff",
      },
    ],
    enchantments: [],
    sellPriceCopper: 52_116,
    quantity: 1,
  });
