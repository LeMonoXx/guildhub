using GuildHub.ModelBaker.Cli.Options;

namespace GuildHub.ModelBaker.Cli.Serve;

public sealed record ServeOptions(string OutputDirectory, string CacheDirectory, string Region)
{
  public static bool TryParse(IReadOnlyList<string> args, out ServeOptions? options, out string? error)
  {
    if (!LookCommandOptions.TryParse(args, out var parsed, out error))
    {
      options = null;
      return false;
    }
    if (parsed!.LookFile != null || parsed.LooksDirectory != null)
    {
      options = null;
      error = "serve takes looks on stdin, not --look or --looks.";
      return false;
    }
    options = new(parsed.OutputDirectory, parsed.CacheDirectory, parsed.Region);
    return true;
  }
}
