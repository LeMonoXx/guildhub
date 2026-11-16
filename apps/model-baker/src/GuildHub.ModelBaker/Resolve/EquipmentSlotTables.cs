// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

// Portions ported from wow.export (https://github.com/Kruithne/wow.export), MIT License,
// Copyright (c) Kruithne and Marlamin. Ported logic: slot tables, texture layer order and attachment
// IDs (src/js/wow/EquipmentSlots.js) and item geoset groups (src/js/db/caches/DBItemGeosets.js).

namespace GuildHub.ModelBaker.Resolve;

public static class EquipmentSlotTables
{
  public const int ShoulderLeft = 3, ShoulderRight = 30, BackSlot = 15, MainHandSlot = 16, OffHandSlot = 17, RangedSlot = 18;
  public const int OneHandInventoryType = 13;

  // M2 attachment 0, the shield point on the forearm. wow.export's table lists it second for the off
  // hand, so following it puts a one-model shield in the left hand (2), through the arm.
  public const int ShieldAttachment = 0;
  public const int ShieldInventoryType = 14;

  // Inventory type -> equipment slot (EquipmentSlots.js INVENTORY_TYPE_TO_SLOT_ID).
  public static readonly IReadOnlyDictionary<int, int> InventoryTypeToSlot = new Dictionary<int, int>
  {
    [1] = 1,
    [2] = 2,
    [3] = ShoulderLeft,
    [4] = 4,
    [5] = 5,
    [6] = 6,
    [7] = 7,
    [8] = 8,
    [9] = 9,
    [10] = 10,
    [13] = 16,
    [14] = 17,
    [15] = RangedSlot,
    [16] = BackSlot,
    [17] = 16,
    [19] = 19,
    [20] = 5,
    [21] = 16,
    [22] = 17,
    [23] = 17,
    [25] = RangedSlot,
    [26] = RangedSlot,
  };

  // M2 attachment IDs per slot, in ItemDisplayInfo model order (EquipmentSlots.js ATTACHMENT_ID).
  internal static readonly Dictionary<int, int[]> SlotToAttachment = new()
  {
    // A ranged weapon in the right hand; the viewer puts a bow in the left (it knows the subclass).
    [1] = [11],
    [ShoulderLeft] = [6],
    [ShoulderRight] = [5],
    [BackSlot] = [12],
    [16] = [1],
    [17] = [2, 0],
    [RangedSlot] = [1],
  };

  // Texture layer priority per slot: lower draws first (EquipmentSlots.js SLOT_LAYER).
  internal static readonly Dictionary<int, int> SlotLayer = new()
  {
    [4] = 10,
    [7] = 10,
    [1] = 11,
    [8] = 11,
    [3] = 13,
    [30] = 13,
    [5] = 13,
    [19] = 17,
    [6] = 18,
    [9] = 19,
    [10] = 20,
    [16] = 21,
    [17] = 22,
    [15] = 23,
  };

  // Body texture sections each equipment slot paints (0 arm upper, 1 arm lower, 2 hand, 3 torso upper,
  // 4 torso lower, 5 leg upper, 6 leg lower, 7 foot). Some late displays list sections outside their
  // slot (tier 2.5 shoulders carry legs, the Frostfire Bindings a red torso) that the game doesn't
  // show. Taken from the data: each slot's own sections appear on 90-100% of its items, strays on 3-7%.
  internal static readonly Dictionary<int, int[]> SlotSections = new()
  {
    [4] = [0, 1, 3, 4],
    [5] = [0, 1, 3, 4, 5, 6],
    [6] = [4, 5],
    [7] = [5, 6],
    [8] = [6, 7],
    [9] = [1],
    [10] = [1, 2],
    [19] = [3, 4, 5],
  };

  // Slot -> (ItemDisplayInfo.GeosetGroup index, character geoset group, is-feet) (DBItemGeosets.js).
  internal static readonly Dictionary<int, (int index, int group, bool feet)[]> SlotGeosets = new()
  {
    [1] = [(0, 27, false), (1, 21, false)],
    [ShoulderLeft] = [(0, 26, false)],
    [4] = [(0, 8, false), (1, 10, false)],
    [5] = [(0, 8, false), (1, 10, false), (2, 13, false), (3, 22, false), (4, 28, false)],
    [6] = [(0, 18, false)],
    [7] = [(0, 11, false), (1, 9, false), (2, 13, false)],
    [8] = [(0, 5, false), (1, 20, true)],
    [10] = [(0, 4, false), (1, 23, false)],
    [BackSlot] = [(0, 15, false)],
    [19] = [(0, 12, false)],
  };
}
