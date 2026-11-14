using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Tests;

public class FixedLookBakerTests
{
  [Fact]
  public void DropsOnlyTheUnavailableModelsFromAnItem()
  {
    var item = new ResolvedItem
    {
      ItemId = 2361,
      Models = [new ModelSlot(0, 1, [new FilePick(148302, "race"), new FilePick(148303, "any")], [new FilePick(500, "any")])],
      Attachments =
      [
        new Attachment(ItemResolver.ShoulderLeft, 6, 148302, 500),
        new Attachment(ItemResolver.ShoulderRight, 5, 148304, 501),
      ],
      Effects = [new ItemEffect(1, 148302), new ItemEffect(2, 9000)],
      Geosets = [new GeosetChange(13, 1302)],
    };

    var kept = FixedLookBaker.WithoutModels(item, new HashSet<int> { 148302 });

    Assert.Equal([148303], kept.Models[0].Models.Select(m => m.FileDataId));
    Assert.Equal([500], kept.Models[0].Textures.Select(t => t.FileDataId));
    Assert.Equal([148304], kept.Attachments.Select(a => a.ModelFileDataId));
    Assert.Equal([9000], kept.Effects.Select(e => e.ModelFileDataId));
    Assert.Equal(item.Geosets, kept.Geosets);
  }
}
