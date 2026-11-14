using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Tests;

public class LookBakeDocumentTests
{
  [Fact]
  public void ParsesApiLookJsonAndMapsCustomizationsAndHandOverrides()
  {
    var document = LookBakeDocument.Parse("""
        {
          "lookHash": "abc123def4567890",
          "clientBuild": "1.60.1.70938",
          "race": 5,
          "sex": 0,
          "classId": 2,
          "customizations": [{ "optionId": 58, "choiceId": 915 }],
          "items": [3732, 19019],
          "equipmentOverrides": [{ "itemId": 19019, "equipSlot": 16 }],
          "animationIds": [0, 4]
        }
        """);

    var request = document.ToRequest("/tmp/assets");
    Assert.Equal("abc123def4567890", request.LookHash);
    Assert.Equal((5, 0, 2), (request.Race, request.Sex, request.ClassId));
    Assert.Equal(new Dictionary<int, int> { [58] = 915 }, request.Customizations);
    Assert.Equal([3732, 19019], request.ItemIds);
    Assert.Equal([new EquipmentSlotOverride(19019, ItemResolver.MainHandSlot)], request.EquipmentOverrides);
    Assert.Equal([0, 4], request.AnimationIds);
    Assert.Equal("looks/abc123def4567890/look.json", FixedLookBaker.ManifestPath(request.LookHash));
  }

  [Fact]
  public void UsesTroopAnimationsWhenTheDocumentOmitsThem()
  {
    var document = LookBakeDocument.Parse("""
        { "lookHash": "x", "race": 1, "sex": 1, "classId": 4, "items": [] }
        """);
    Assert.Equal(FixedLookBaker.TroopAnimationIds, document.ToRequest("out").AnimationIds);
  }
}
