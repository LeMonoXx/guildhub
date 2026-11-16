using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.ProofScenes;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class BakeProofSceneCommand : ICliCommand
{
  public string Name => "bake-proof-scene";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (args.Count == 0)
      return CliUsage.Reject(error, "Missing proof scene name.");
    if (!ProofSceneCatalog.TryGet(args[0], out var scene))
      return CliUsage.Reject(error, $"Unknown proof scene: {args[0]}");
    if (!FixedLookOptions.TryParse(
        args.Skip(1).ToArray(),
        scene!.Options,
        out var options,
        out var message))
      return CliUsage.Reject(error, message);
    return await BakeFixedCommand.BakeAsync(options!, output, error, cancellationToken);
  }
}
