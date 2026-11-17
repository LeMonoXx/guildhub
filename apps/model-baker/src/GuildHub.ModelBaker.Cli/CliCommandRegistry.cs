using GuildHub.ModelBaker.Cli.Commands;

namespace GuildHub.ModelBaker.Cli;

public static class CliCommandRegistry
{
  public static readonly IReadOnlyDictionary<string, ICliCommand> Default = Create(
      new BakeFixedCommand(),
      new BakeLookCommand(),
      new BakeLooksCommand(),
      new BakeFileCommand(),
      new BakeWorldMapCommand(),
      new ServeCliCommand(),
      new BakeProofSceneCommand());

  public static IReadOnlyDictionary<string, ICliCommand> Create(params ICliCommand[] commands) =>
      commands.ToDictionary(command => command.Name, StringComparer.Ordinal);
}
