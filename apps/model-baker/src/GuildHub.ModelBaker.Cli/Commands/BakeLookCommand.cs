using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeLookCommand : ICliCommand
{
  public string Name => "bake-look";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!LookCommandOptions.TryParse(args, out var options, out var message)
        || options?.LookFile is null)
      return CliUsage.Reject(error, message ?? "Missing --look <file>.");
    return await BakeAsync(options.LookFile, options, output, error, cancellationToken);
  }

  static Task<int> BakeAsync(
      string lookFile,
      LookCommandOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken) =>
      BakeCommandSupport.GuardAsync(error, async () =>
      {
        var document = LookBakeDocument.Parse(await File.ReadAllTextAsync(lookFile, cancellationToken));
        await using var session = await BakeSessionFactory.OpenAsync(
            options.CacheDirectory,
            options.Region,
            output,
            cancellationToken);
        var request = document.ToRequest(options.OutputDirectory);
        var manifest = session.Baker.Bake(request, output.WriteLine);
        output.WriteLine(
            $"Look ready: {Path.Combine(options.OutputDirectory, AssetStorePaths.ManifestPath(request.LookHash))}");
        output.WriteLine(BakeCommandSupport.Summary(manifest));
        return 0;
      });
}
