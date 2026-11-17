using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Maps;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeWorldMapCommand : ICliCommand
{
  public string Name => "bake-world-map";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!SharedBakeOptions.TryParse(
            args,
            SharedBakeOptions.Default() with { OutputDirectory = Path.GetFullPath(Path.Combine("apps", "model-baker", "assets")) },
            SharedBakeOptions.InvalidOption,
            out var options,
            out var message))
      return CliUsage.Reject(error, message);
    return await BakeCommandSupport.GuardAsync(error, async () =>
    {
      await using var session = await BakeSessionFactory.OpenAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      var atlas = session.Maps.Bake(options.OutputDirectory, output.WriteLine);
      output.WriteLine(
          $"World map ready: {AssetStorePaths.FullPath(options.OutputDirectory, WorldMapBaker.AtlasPath)} ({atlas.Continents.Count} continents)");
      return 0;
    });
  }
}
