// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

namespace GuildHub.ModelBaker.Resolve;

// An explicit effective equipment slot. This is request policy, not item-table data: the item's
// InventoryType remains unchanged while all slot-dependent placement is recomputed.
public sealed record EquipmentSlotOverride(int ItemId, int EquipSlot);
