using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeFixedCommand : ICliCommand
{
  public string Name => "bake-fixed";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!FixedLookOptions.TryParse(args, out var options, out var message))
      return CliUsage.Reject(error, message);
    return await BakeAsync(options!, output, error, cancellationToken);
  }

  internal static Task<int> BakeAsync(
      FixedLookOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken) =>
      BakeCommandSupport.GuardAsync(error, async () =>
      {
        await using var session = await BakeSessionFactory.OpenAsync(
            options.CacheDirectory,
            options.Region,
            output,
            cancellationToken);
        var result = FixedLookBakeRunner.Run(session.Baker, options, output.WriteLine);
        output.WriteLine(
            $"Fixed look ready: {AssetStorePaths.FullPath(options.OutputDirectory, result.ManifestPath)}");
        output.WriteLine(BakeCommandSupport.Summary(result.Manifest));
        return 0;
      });
}
