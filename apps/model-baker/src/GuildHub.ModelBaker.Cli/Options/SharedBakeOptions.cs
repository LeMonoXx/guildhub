namespace GuildHub.ModelBaker.Cli.Options;

public sealed record SharedBakeOptions(string OutputDirectory, string CacheDirectory, string Region)
{
  public static SharedBakeOptions Default() => new(
      Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "fixed")),
      Path.GetFullPath(Path.Combine("apps", "model-baker", "cache")),
      "eu");

  /// <summary>
  /// Reads name/value pairs. --output, --cache and --region are read here; every other pair goes to
  /// <paramref name="readOther"/>, which returns null when it accepts the pair and the error otherwise.
  /// </summary>
  public static bool TryParse(
      IReadOnlyList<string> args,
      SharedBakeOptions start,
      Func<string, string, string?> readOther,
      out SharedBakeOptions parsed,
      out string? error)
  {
    parsed = start;
    for (var index = 0; index < args.Count; index++)
    {
      var name = args[index];
      if (index + 1 >= args.Count)
      {
        error = $"Missing value for {name}.";
        return false;
      }
      var value = args[++index];
      if (parsed.With(name, value) is { } updated)
      {
        parsed = updated;
        continue;
      }
      error = readOther(name, value);
      if (error != null) return false;
    }
    error = null;
    return true;
  }

  public static string InvalidOption(string name, string value) =>
      $"Invalid option or value: {name} {value}.";

  SharedBakeOptions? With(string name, string value) => name switch
  {
    "--output" => this with { OutputDirectory = Path.GetFullPath(value) },
    "--cache" => this with { CacheDirectory = Path.GetFullPath(value) },
    "--region" => this with { Region = value },
    _ => null,
  };
}
