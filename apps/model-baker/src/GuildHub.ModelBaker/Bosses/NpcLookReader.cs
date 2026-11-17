using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Resolve;
using GuildHub.ModelBaker.Tables;
using T = GuildHub.ModelBaker.Tables.GameTableNames;

namespace GuildHub.ModelBaker.Bosses;

/// <summary>A creature the game draws as a character: its body, its choices and its armour.</summary>
public sealed record NpcLook(
    int Race,
    int Sex,
    IReadOnlyDictionary<int, int> Customizations,
    IReadOnlyList<ItemDisplaySlot> ItemDisplays);

/// <summary>Reads how the client dresses a creature display that has character data.</summary>
public sealed class NpcLookReader(ITables tables)
{
  // NPCModelItemSlotDisplayInfo.ItemSlot -> equipment slot: head, shoulder, shirt, chest, waist,
  // legs, feet, wrist, hands, tabard, back.
  static readonly IReadOnlyDictionary<int, int> EquipSlotByNpcSlot = new Dictionary<int, int>
  {
    [0] = 1,
    [1] = EquipmentSlotTables.ShoulderLeft,
    [2] = 4,
    [3] = 5,
    [4] = 6,
    [5] = 7,
    [6] = 8,
    [7] = 9,
    [8] = 10,
    [9] = 19,
    [10] = EquipmentSlotTables.BackSlot,
  };

  readonly Dictionary<int, Row> _extras = tables.Get(T.CreatureDisplayInfoExtra).ById();
  readonly Dictionary<int, List<Row>> _options =
      tables.Get(T.CreatureDisplayInfoOption).GroupByColumn("CreatureDisplayInfoExtraID");
  readonly Dictionary<int, List<Row>> _items =
      tables.Get(T.NPCModelItemSlotDisplayInfo).GroupByColumn("NpcModelID");

  public NpcLook? Read(int extendedDisplayInfoId)
  {
    if (!_extras.TryGetValue(extendedDisplayInfoId, out var extra)) return null;
    var customizations = _options.Of(extendedDisplayInfoId).ToDictionary(
        option => option.Int("ChrCustomizationOptionID"),
        option => option.Int("ChrCustomizationChoiceID"));
    var items = _items.Of(extendedDisplayInfoId)
        .Where(item => item.Int("ItemDisplayInfoID") != 0 && EquipSlotByNpcSlot.ContainsKey(item.Int("ItemSlot")))
        .Select(item => new ItemDisplaySlot(item.Int("ItemDisplayInfoID"), EquipSlotByNpcSlot[item.Int("ItemSlot")]))
        .ToList();
    return new(extra.Int("DisplayRaceID"), extra.Int("DisplaySexID"), customizations, items);
  }
}
