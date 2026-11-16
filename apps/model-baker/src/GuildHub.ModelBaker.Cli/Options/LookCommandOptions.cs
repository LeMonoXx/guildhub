namespace GuildHub.ModelBaker.Cli.Options;

public sealed record LookCommandOptions(
    string OutputDirectory,
    string CacheDirectory,
    string Region,
    string? LookFile,
    string? LooksDirectory)
{
  public static bool TryParse(
      IReadOnlyList<string> args,
      out LookCommandOptions? options,
      out string? error)
  {
    string? lookFile = null;
    string? looksDirectory = null;

    string? Read(string name, string value)
    {
      switch (name)
      {
        case "--look":
          lookFile = Path.GetFullPath(value);
          return null;
        case "--looks":
          looksDirectory = Path.GetFullPath(value);
          return null;
        default:
          return SharedBakeOptions.InvalidOption(name, value);
      }
    }

    if (!SharedBakeOptions.TryParse(args, SharedBakeOptions.Default(), Read, out var shared, out error))
    {
      options = null;
      return false;
    }
    options = new(shared.OutputDirectory, shared.CacheDirectory, shared.Region, lookFile, looksDirectory);
    return true;
  }
}
