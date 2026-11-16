namespace GuildHub.ModelBaker.Cli;

public static class CliApplication
{
  public static Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken = default)
      => RunAsync(CliCommandRegistry.Default, args, output, error, cancellationToken);

  public static async Task<int> RunAsync(
      IReadOnlyDictionary<string, ICliCommand> commands,
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken = default)
  {
    if (args.Count == 0 || args.Count == 1 && args[0] is "--help" or "-h")
    {
      output.WriteLine(CliUsage.Text);
      return 0;
    }
    if (!commands.TryGetValue(args[0], out var command))
      return CliUsage.Reject(error, $"Unknown argument: {args[0]}");
    return await command.RunAsync(args.Skip(1).ToArray(), output, error, cancellationToken);
  }
}
