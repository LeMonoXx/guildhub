using GuildHub.ModelBaker.Bosses;
using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeBossesCommand : ICliCommand
{
  public string Name => "bake-bosses";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    var displays = new List<int>();
    string? ReadDisplay(string name, string value)
    {
      if (name != "--display" || !int.TryParse(value, out var displayId) || displayId <= 0)
        return SharedBakeOptions.InvalidOption(name, value);
      displays.Add(displayId);
      return null;
    }
    if (!SharedBakeOptions.TryParse(args, SharedBakeOptions.Default(), ReadDisplay, out var options, out var message))
      return CliUsage.Reject(error, message);
    if (displays.Count == 0)
      return CliUsage.Reject(error, "bake-bosses needs at least one --display.");
    return await BakeCommandSupport.GuardAsync(error, async () =>
    {
      await using var session = await BakeSessionFactory.OpenAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      var result = session.Bosses.Bake(options.OutputDirectory, displays, output.WriteLine);
      output.WriteLine(
          $"Bosses ready in {AssetStorePaths.FullPath(options.OutputDirectory, BossBaker.Root)}: {result.Baked.Count} baked, {result.Skipped.Count} skipped");
      return 0;
    });
  }
}
