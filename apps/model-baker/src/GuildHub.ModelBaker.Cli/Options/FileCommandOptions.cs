namespace GuildHub.ModelBaker.Cli.Options;

public sealed record FileCommandOptions(
    string OutputDirectory,
    string CacheDirectory,
    string Region,
    string Kind,
    int FileId,
    int? ModelFileId,
    int? AnimationId)
{
  public static bool TryParse(
      IReadOnlyList<string> args,
      out FileCommandOptions? options,
      out string? error)
  {
    string? kind = null;
    int? fileId = null;
    int? modelFileId = null;
    int? animationId = null;

    string? Read(string name, string value)
    {
      switch (name)
      {
        case "--kind" when value is "model" or "texture" or "animation":
          kind = value;
          return null;
        case "--file-id" when int.TryParse(value, out var parsedFile) && parsedFile > 0:
          fileId = parsedFile;
          return null;
        case "--model-file-id" when int.TryParse(value, out var parsedModel) && parsedModel > 0:
          modelFileId = parsedModel;
          return null;
        case "--animation-id" when int.TryParse(value, out var parsedAnim) && parsedAnim >= 0:
          animationId = parsedAnim;
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
    if (kind is null || fileId is null)
    {
      options = null;
      error = "bake-file requires --kind and --file-id.";
      return false;
    }
    options = new(shared.OutputDirectory, shared.CacheDirectory, shared.Region, kind, fileId.Value, modelFileId, animationId);
    return true;
  }
}
