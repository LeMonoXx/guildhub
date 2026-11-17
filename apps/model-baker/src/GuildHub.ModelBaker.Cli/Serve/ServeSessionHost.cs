using GuildHub.ModelBaker.Cli.Sessions;

namespace GuildHub.ModelBaker.Cli.Serve;

/// <summary>
/// Opens the game storage on the first request that needs it and keeps it open until the build
/// changes. The current build is rechecked at most every ten minutes.
/// </summary>
public sealed class ServeSessionHost(ServeOptions options, TextWriter log) : IAsyncDisposable
{
  static readonly TimeSpan VersionRecheck = TimeSpan.FromMinutes(10);

  BakeSession? _session;
  string? _build;
  DateTimeOffset _buildCheckedAt = DateTimeOffset.MinValue;

  public string? SessionBuild { get; private set; }

  public async Task<string> CurrentBuildAsync(CancellationToken cancellationToken)
  {
    var now = DateTimeOffset.UtcNow;
    if (_build != null && now - _buildCheckedAt < VersionRecheck) return _build;
    var entry = await BuildVersionSource.ReadAsync(options.Region, cancellationToken);
    _build = entry.VersionsName;
    _buildCheckedAt = now;
    return _build;
  }

  // `stage` hears "opening" before the storage opens and "baking" once it is open.
  public async Task<BakeSession> SessionAsync(Action<string> stage, CancellationToken cancellationToken)
  {
    var build = await CurrentBuildAsync(cancellationToken);
    if (_session != null && SessionBuild == build) return _session;
    if (_session != null)
    {
      log.WriteLine($"Build changed from {SessionBuild} to {build}; reopening.");
      await _session.DisposeAsync();
      _session = null;
    }
    stage("opening");
    _session = await BakeSessionFactory.OpenAsync(
        options.CacheDirectory,
        options.Region,
        log,
        cancellationToken);
    SessionBuild = _session.Build;
    stage("baking");
    return _session;
  }

  public async ValueTask DisposeAsync()
  {
    if (_session != null) await _session.DisposeAsync();
  }
}
