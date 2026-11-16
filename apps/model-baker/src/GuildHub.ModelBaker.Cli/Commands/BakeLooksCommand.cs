using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeLooksCommand : ICliCommand
{
  public string Name => "bake-looks";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!LookCommandOptions.TryParse(args, out var options, out var message)
        || options?.LooksDirectory is null)
      return CliUsage.Reject(error, message ?? "Missing --looks <dir>.");

    var looksRoot = options.LooksDirectory;
    if (!Directory.Exists(looksRoot))
    {
      error.WriteLine($"Looks directory not found: {looksRoot}");
      return 2;
    }
    var files = Directory.GetFiles(looksRoot, "look.request.json", SearchOption.AllDirectories)
        .OrderBy(path => path, StringComparer.Ordinal)
        .ToList();
    if (files.Count == 0)
    {
      error.WriteLine($"No look.request.json files under {looksRoot}.");
      return 2;
    }
    return await BakeCommandSupport.GuardAsync(
        error,
        () => BakeAllAsync(files, options, output, error, cancellationToken));
  }

  static async Task<int> BakeAllAsync(
      IReadOnlyList<string> files,
      LookCommandOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    await using var session = await BakeSessionFactory.OpenAsync(
        options.CacheDirectory,
        options.Region,
        output,
        cancellationToken);
    var baked = 0;
    var failed = 0;
    foreach (var file in files)
    {
      cancellationToken.ThrowIfCancellationRequested();
      try
      {
        var document = LookBakeDocument.Parse(await File.ReadAllTextAsync(file, cancellationToken));
        var request = document.ToRequest(options.OutputDirectory);
        var manifestPath = AssetStorePaths.FullPath(
            options.OutputDirectory,
            AssetStorePaths.ManifestPath(request.LookHash));
        if (File.Exists(manifestPath))
        {
          output.WriteLine($"Look {request.LookHash} exists, skipped");
          continue;
        }
        var manifest = session.Baker.Bake(request, output.WriteLine);
        output.WriteLine(
            $"Look ready: {manifestPath} ({manifest.Items.Count} items, {manifest.Animations.Count} animations)");
        baked++;
      }
      catch (Exception exception)
      {
        failed++;
        error.WriteLine($"Bake failed for {file}: {exception.Message}");
      }
    }
    output.WriteLine($"Baked {baked} of {files.Count} looks.");
    return failed == 0 ? 0 : 1;
  }
}
