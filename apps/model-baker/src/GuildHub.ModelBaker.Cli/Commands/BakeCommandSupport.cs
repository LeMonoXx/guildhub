using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Commands;

static class BakeCommandSupport
{
  // Exit code 1: the command line was valid but the bake failed.
  public static async Task<int> GuardAsync(TextWriter error, Func<Task<int>> bake)
  {
    try
    {
      return await bake();
    }
    catch (Exception exception)
    {
      error.WriteLine($"Bake failed: {exception.Message}");
      return 1;
    }
  }

  public static string Summary(FixedLookManifest manifest) =>
      $"Build {manifest.Build}, {manifest.Items.Count} items, {manifest.Animations.Count} animations.";
}
