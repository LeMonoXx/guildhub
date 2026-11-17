using System.Text.Json;
using GuildHub.ModelBaker.Bosses;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Tests;

public class BossBakerTests
{
  sealed class NoFiles : IGameFiles
  {
    public byte[] Open(uint fileDataId) => throw new FileNotFoundException($"file {fileDataId}");
    public bool Exists(uint fileDataId) => false;
  }

  static Dictionary<string, object?> Values(params (string Key, object? Value)[] pairs) =>
      pairs.ToDictionary(p => p.Key, p => p.Value);

  static InMemoryTables Displays() => new InMemoryTables()
      .Add("CreatureDisplayInfo",
          Values(("ID", 1), ("ModelID", 10), ("ExtendedDisplayInfoID", 0), ("TextureVariationFileDataID", new[] { 700, 0, 0, 0 })),
          Values(("ID", 2), ("ModelID", 11), ("ExtendedDisplayInfoID", 5), ("TextureVariationFileDataID", new[] { 0, 0, 0, 0 })))
      .Add("CreatureModelData",
          Values(("ID", 10), ("FileDataID", 500)),
          Values(("ID", 11), ("FileDataID", 501)));

  [Fact]
  public void KeepsCurrentBossesAndSkipsDisplaysDrawnAsCharacters()
  {
    var output = Directory.CreateTempSubdirectory("bosses").FullName;
    try
    {
      var manifest = Path.Combine(output, "bosses", "v1", "1.json");
      Directory.CreateDirectory(Path.GetDirectoryName(manifest)!);
      File.WriteAllText(
          manifest,
          JsonSerializer.Serialize(
              new BossManifest(1, "b1", 1, new BossModelAsset("m.glb", "m.json", 500), "t/", new Dictionary<int, int> { [11] = 700 }),
              new JsonSerializerOptions(JsonSerializerDefaults.Web)));

      var result = new BossBaker(new NoFiles(), Displays(), "b1").Bake(output, [1, 2, 3]);

      Assert.Equal([1], result.Baked);
      Assert.Equal([2, 3], result.Skipped);
    }
    finally
    {
      Directory.Delete(output, recursive: true);
    }
  }

  [Fact]
  public void RebakesABossFromAnotherBuild()
  {
    var output = Directory.CreateTempSubdirectory("bosses").FullName;
    try
    {
      var manifest = Path.Combine(output, "bosses", "v1", "1.json");
      Directory.CreateDirectory(Path.GetDirectoryName(manifest)!);
      File.WriteAllText(manifest, """{"schemaVersion":1,"build":"old","displayId":1}""");

      Assert.Throws<FileNotFoundException>(
          () => new BossBaker(new NoFiles(), Displays(), "b1").Bake(output, [1]));
    }
    finally
    {
      Directory.Delete(output, recursive: true);
    }
  }
}
