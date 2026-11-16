using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Cli.ProofScenes;

public static class ProofSceneCatalog
{
  public static readonly ProofScene RogueTier2 = CreateRogueTier2();

  public static bool TryGet(string name, out ProofScene? scene)
  {
    scene = string.Equals(name, RogueTier2.Name, StringComparison.OrdinalIgnoreCase)
        ? RogueTier2
        : null;
    return scene != null;
  }

  static ProofScene CreateRogueTier2()
  {
    var shared = SharedBakeOptions.Default();
    return new(
        "rogue-t2",
        new(
            Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "proof", "rogue-t2")),
            shared.CacheDirectory,
            shared.Region,
            1,
            0,
            [16908, 16832, 16905, 16911, 16907, 16910, 16909, 16906, 18816, 18805],
            [0, 4, 5, 26, 32, 54, 114, 115, 116, 119, 120, 123, 128, 129, 224],
            4,
            [
                new(18816, ItemResolver.MainHandSlot),
                new(18805, ItemResolver.OffHandSlot),
            ]));
  }
}
