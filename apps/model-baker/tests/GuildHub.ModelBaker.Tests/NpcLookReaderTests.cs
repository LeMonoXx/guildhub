using GuildHub.ModelBaker.Bosses;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Tests;

public class NpcLookReaderTests
{
  static Dictionary<string, object?> Values(params (string Key, object? Value)[] pairs) =>
      pairs.ToDictionary(p => p.Key, p => p.Value);

  static InMemoryTables Npc() => new InMemoryTables()
      .Add("CreatureDisplayInfoExtra",
          Values(("ID", 879), ("DisplayRaceID", 1), ("DisplaySexID", 0)))
      .Add("CreatureDisplayInfoOption",
          Values(("ID", 1), ("CreatureDisplayInfoExtraID", 879), ("ChrCustomizationOptionID", 9), ("ChrCustomizationChoiceID", 1)),
          Values(("ID", 2), ("CreatureDisplayInfoExtraID", 879), ("ChrCustomizationOptionID", 10), ("ChrCustomizationChoiceID", 24)),
          Values(("ID", 3), ("CreatureDisplayInfoExtraID", 655), ("ChrCustomizationOptionID", 14), ("ChrCustomizationChoiceID", 95)))
      .Add("NPCModelItemSlotDisplayInfo",
          Values(("ID", 1), ("NpcModelID", 879), ("ItemDisplayInfoID", 11258), ("ItemSlot", 0)),
          Values(("ID", 2), ("NpcModelID", 879), ("ItemDisplayInfoID", 11432), ("ItemSlot", 1)),
          Values(("ID", 3), ("NpcModelID", 879), ("ItemDisplayInfoID", 13625), ("ItemSlot", 3)),
          Values(("ID", 4), ("NpcModelID", 879), ("ItemDisplayInfoID", 0), ("ItemSlot", 5)),
          Values(("ID", 5), ("NpcModelID", 879), ("ItemDisplayInfoID", 900), ("ItemSlot", 42)),
          Values(("ID", 6), ("NpcModelID", 879), ("ItemDisplayInfoID", 777), ("ItemSlot", 10)));

  [Fact]
  public void ReadsBodyChoicesAndArmourInEquipmentSlots()
  {
    var look = new NpcLookReader(Npc()).Read(879);

    Assert.NotNull(look);
    Assert.Equal(1, look.Race);
    Assert.Equal(0, look.Sex);
    Assert.Equal(new Dictionary<int, int> { [9] = 1, [10] = 24 }, look.Customizations);
    Assert.Equal(
        [new ItemDisplaySlot(11258, 1), new ItemDisplaySlot(11432, 3), new ItemDisplaySlot(13625, 5), new ItemDisplaySlot(777, 15)],
        look.ItemDisplays);
  }

  [Fact]
  public void HasNoLookForAnUnknownDisplay() => Assert.Null(new NpcLookReader(Npc()).Read(1));
}
