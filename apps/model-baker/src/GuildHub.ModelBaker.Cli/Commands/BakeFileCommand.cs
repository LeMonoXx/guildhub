using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.Sessions;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeFileCommand : ICliCommand
{
  public string Name => "bake-file";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!FileCommandOptions.TryParse(args, out var options, out var message))
      return CliUsage.Reject(error, message);
    return await BakeAsync(options!, output, error, cancellationToken);
  }

  static Task<int> BakeAsync(
      FileCommandOptions options,
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
        session.Baker.BakeSharedFile(
            options.OutputDirectory,
            options.Kind,
            options.FileId,
            options.ModelFileId,
            options.AnimationId,
            output.WriteLine);
        return 0;
      });
}
