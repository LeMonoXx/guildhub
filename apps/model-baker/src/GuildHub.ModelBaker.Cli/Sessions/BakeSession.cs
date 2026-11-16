using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Sessions;

public sealed class BakeSession(
    HttpClient http,
    FixedLookBaker baker,
    string build) : IAsyncDisposable
{
  public FixedLookBaker Baker { get; } = baker;
  public string Build { get; } = build;

  public ValueTask DisposeAsync()
  {
    http.Dispose();
    return ValueTask.CompletedTask;
  }
}
