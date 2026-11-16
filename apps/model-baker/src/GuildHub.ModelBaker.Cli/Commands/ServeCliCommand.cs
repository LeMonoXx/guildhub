using GuildHub.ModelBaker.Cli.Serve;

namespace GuildHub.ModelBaker.Cli.Commands;

public sealed class ServeCliCommand : ICliCommand
{
  public string Name => "serve";

  public async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    if (!ServeOptions.TryParse(args, out var serveOptions, out var message))
      return CliUsage.Reject(error, message);
    // TACTSharp reports download retries on Console.Out, which carries the protocol here.
    if (ReferenceEquals(output, Console.Out)) Console.SetOut(Console.Error);
    return await new ServeCommand(serveOptions!, Console.In, output, error)
        .RunAsync(cancellationToken);
  }
}
