import { describe, expect, it } from "vitest";
import { mapCharacterFacts } from "./map-character-facts.js";

const appearance = {
  playable_race: { id: 5, name: "Undead" },
  playable_class: { id: 2, name: "Paladin" },
  gender: { type: "MALE", name: "Male" },
  customizations: [
    {
      option: { name: "Skin Color", id: 58 },
      choice: { id: 915, display_order: 2 },
    },
    { option: { name: "Face", id: 59 }, choice: { id: 940, display_order: 0 } },
  ],
  items: [
    {
      id: 3732,
      slot: { type: "HEAD", name: "Head" },
      enchant: 0,
      internal_slot_id: 0,
    },
  ],
};

const equipment = {
  equipped_items: [
    {
      item: { id: 3732 },
      slot: { type: "HEAD", name: "Head" },
    },
    {
      item: { id: 19019 },
      slot: { type: "MAIN_HAND", name: "Main Hand" },
      transmog: {
        item: { id: 18816, name: "Other" },
        item_modified_appearance_id: 1,
      },
    },
    {
      item: { id: 18805 },
      slot: { type: "OFF_HAND", name: "Off Hand" },
      inventory_type: { type: "SHIELD", name: "Shield" },
    },
  ],
};

const media = {
  assets: [
    {
      key: "main-raw",
      value: "https://render.worldofwarcraft.com/character.png",
    },
    { key: "avatar", value: "https://render.worldofwarcraft.com/avatar.png" },
  ],
};

describe("mapCharacterFacts", () => {
  it("maps Forever appearance choice IDs, transmog items, hand slots, and main-raw media", () => {
    const facts = mapCharacterFacts({
      appearance,
      equipment,
      media,
      fallbackRaceId: 1,
      fallbackClassId: 1,
    });
    expect(facts).toMatchObject({
      raceId: 5,
      sex: 0,
      classId: 2,
      customizations: [
        { optionId: 58, choiceId: 915 },
        { optionId: 59, choiceId: 940 },
      ],
      itemIds: [3732, 18816, 18805],
      equipmentOverrides: [
        { itemId: 18816, equipSlot: 16 },
        { itemId: 18805, equipSlot: 17 },
      ],
      renderAssetUrl: "https://render.worldofwarcraft.com/character.png",
      carries: ["shield"],
    });
  });

  it("falls back to appearance items and roster race when equipment is empty", () => {
    const facts = mapCharacterFacts({
      appearance: {
        ...appearance,
        gender: { type: "FEMALE", name: "Female" },
        playable_race: {},
      },
      equipment: { equipped_items: [] },
      media: { assets: [] },
      fallbackRaceId: 1,
      fallbackClassId: 4,
    });
    expect(facts.sex).toBe(1);
    expect(facts.raceId).toBe(1);
    expect(facts.itemIds).toEqual([3732]);
    expect(facts.renderAssetUrl).toBeUndefined();
    expect(facts.carries).toBeUndefined();
  });
});
