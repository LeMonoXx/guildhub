namespace GuildHub.ModelBaker.Cli;

public interface ICliCommand
{
  // The first command-line argument that selects this command.
  string Name { get; }

  // `args` are the arguments after the command name.
  Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken);
}
