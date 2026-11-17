using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Maps;

namespace GuildHub.ModelBaker.Cli.Sessions;

public sealed class BakeSession(
    HttpClient http,
    FixedLookBaker baker,
    WorldMapBaker maps,
    string build) : IAsyncDisposable
{
  public FixedLookBaker Baker { get; } = baker;
  public WorldMapBaker Maps { get; } = maps;
  public string Build { get; } = build;

  public ValueTask DisposeAsync()
  {
    http.Dispose();
    return ValueTask.CompletedTask;
  }
}
