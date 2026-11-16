using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli;

public static class FixedLookBakeRunner
{
  public static FixedLookBakeResult Run(
      FixedLookBaker baker,
      FixedLookOptions options,
      Action<string> log,
      Action<double>? progress = null)
  {
    var manifest = baker.Bake(
        new(
            options.OutputDirectory,
            options.Race,
            options.Sex,
            options.ItemIds,
            options.AnimationIds,
            options.ClassId,
            options.EquipmentOverrides),
        log,
        progress);
    return new(manifest, AssetStorePaths.ManifestPath(null));
  }
}
