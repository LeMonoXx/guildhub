using System.Text.Json;
using System.Text.Json.Nodes;
using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Storage;

namespace GuildHub.ModelBaker.Cli;

/// <summary>
/// One long-lived baker: requests arrive as JSON lines on stdin, events leave as JSON
/// lines on stdout, and human logs go to stderr. The game storage opens on the first
/// request that needs it and stays open, so later looks skip the CDN indexes and tables.
/// Closing stdin ends the process; the caller decides how long an idle baker may live.
/// </summary>
public sealed class ServeCommand(
    ServeOptions options,
    TextReader input,
    TextWriter events,
    TextWriter log)
{
  static readonly TimeSpan VersionRecheck = TimeSpan.FromMinutes(10);
  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

  BakeSession? _session;
  string? _sessionBuild;
  CurrentVersion? _version;
  DateTimeOffset _versionCheckedAt = DateTimeOffset.MinValue;

  public async Task<int> RunAsync(CancellationToken cancellationToken)
  {
    Emit(new JsonObject { ["event"] = "ready" });
    try
    {
      while (await input.ReadLineAsync(cancellationToken) is { } line)
      {
        if (string.IsNullOrWhiteSpace(line)) continue;
        await HandleAsync(line, cancellationToken);
      }
      return 0;
    }
    finally
    {
      if (_session != null) await _session.DisposeAsync();
    }
  }

  async Task HandleAsync(string line, CancellationToken cancellationToken)
  {
    string? id = null;
    try
    {
      var request = JsonNode.Parse(line)?.AsObject()
          ?? throw new InvalidOperationException("A request must be a JSON object.");
      id = request["id"]?.GetValue<string>()
          ?? throw new InvalidOperationException("A request needs an id.");
      var command = request["command"]?.GetValue<string>();
      var result = command switch
      {
        "build" => await BuildAsync(cancellationToken),
        "look" => await LookAsync(id, request, cancellationToken),
        "fixed" => await FixedAsync(id, cancellationToken),
        "file" => await FileAsync(id, request, cancellationToken),
        "prebake" => await PrebakeAsync(id, request, cancellationToken),
        _ => throw new InvalidOperationException($"Unknown command: {command}"),
      };
      Emit(new JsonObject { ["id"] = id, ["event"] = "done", ["result"] = result });
    }
    catch (Exception exception) when (exception is not OperationCanceledException)
    {
      log.WriteLine($"Bake failed: {exception.Message}");
      Emit(new JsonObject
      {
        ["id"] = id,
        ["event"] = "failed",
        ["message"] = exception.Message,
      });
    }
  }

  async Task<JsonNode> BuildAsync(CancellationToken cancellationToken)
  {
    var version = await VersionAsync(cancellationToken);
    return new JsonObject { ["build"] = version.Build };
  }

  async Task<JsonNode> LookAsync(string id, JsonObject request, CancellationToken cancellationToken)
  {
    var raw = request["look"]?.ToJsonString()
        ?? throw new InvalidOperationException("A look request needs a look.");
    var bake = LookBakeDocument.Parse(raw).ToRequest(options.OutputDirectory);
    var baker = await BakerAsync(id, cancellationToken);
    var manifest = baker.Bake(bake, log.WriteLine, fraction => Progress(id, fraction));
    return new JsonObject
    {
      ["build"] = manifest.Build,
      ["manifest"] = FixedLookBaker.ManifestPath(bake.LookHash),
    };
  }

  async Task<JsonNode> FixedAsync(string id, CancellationToken cancellationToken)
  {
    if (!FixedLookOptions.TryParse(
        ["--output", options.OutputDirectory, "--cache", options.CacheDirectory, "--region", options.Region],
        out var fixedOptions,
        out var error))
      throw new InvalidOperationException(error);
    var baker = await BakerAsync(id, cancellationToken);
    var manifest = baker.Bake(
        new(
            options.OutputDirectory,
            fixedOptions!.Race,
            fixedOptions.Sex,
            fixedOptions.ItemIds,
            fixedOptions.AnimationIds,
            fixedOptions.ClassId,
            fixedOptions.EquipmentOverrides),
        log.WriteLine,
        fraction => Progress(id, fraction));
    return new JsonObject
    {
      ["build"] = manifest.Build,
      ["manifest"] = FixedLookBaker.ManifestPath(null),
    };
  }

  async Task<JsonNode> FileAsync(string id, JsonObject request, CancellationToken cancellationToken)
  {
    var kind = request["kind"]?.GetValue<string>()
        ?? throw new InvalidOperationException("A file request needs a kind.");
    var fileId = request["fileId"]?.GetValue<int>()
        ?? throw new InvalidOperationException("A file request needs a fileId.");
    var baker = await BakerAsync(id, cancellationToken);
    baker.BakeSharedFile(
        options.OutputDirectory,
        kind,
        fileId,
        request["modelFileId"]?.GetValue<int>(),
        request["animationId"]?.GetValue<int>(),
        log.WriteLine);
    return new JsonObject { ["build"] = _sessionBuild };
  }

  /// <summary>
  /// A marker per race and sex records a finished prebake of a build, so a check against
  /// an unchanged build answers from the marker without opening the game storage.
  /// </summary>
  async Task<JsonNode> PrebakeAsync(string id, JsonObject request, CancellationToken cancellationToken)
  {
    var race = request["race"]?.GetValue<int>()
        ?? throw new InvalidOperationException("A prebake request needs a race.");
    var sex = request["sex"]?.GetValue<int>()
        ?? throw new InvalidOperationException("A prebake request needs a sex.");
    var version = await VersionAsync(cancellationToken);
    var marker = Path.Combine(
        options.OutputDirectory,
        "builds",
        version.Build,
        $"v{AssetConverter.OutputVersion}",
        "prebake",
        $"{race}-{sex}.json");
    if (File.Exists(marker))
      return new JsonObject { ["build"] = version.Build, ["skipped"] = true };
    var baker = await BakerAsync(id, cancellationToken);
    var result = baker.Prebake(
        options.OutputDirectory,
        race,
        sex,
        FixedLookBaker.TroopAnimationIds,
        log.WriteLine,
        fraction => Progress(id, fraction));
    Directory.CreateDirectory(Path.GetDirectoryName(marker)!);
    await File.WriteAllTextAsync(marker, JsonSerializer.Serialize(result, Json), cancellationToken);
    return new JsonObject
    {
      ["build"] = _sessionBuild,
      ["baked"] = result.Baked,
      ["textures"] = result.Textures,
    };
  }

  async Task<FixedLookBaker> BakerAsync(string id, CancellationToken cancellationToken)
  {
    var version = await VersionAsync(cancellationToken);
    if (_session != null && _sessionBuild == version.Build) return _session.Baker;
    if (_session != null)
    {
      log.WriteLine($"Build changed from {_sessionBuild} to {version.Build}; reopening.");
      await _session.DisposeAsync();
      _session = null;
    }
    Emit(new JsonObject { ["id"] = id, ["event"] = "stage", ["stage"] = "opening" });
    _session = await CliApplication.OpenSessionAsync(
        options.CacheDirectory,
        options.Region,
        log,
        cancellationToken);
    _sessionBuild = _session.Build;
    Emit(new JsonObject { ["id"] = id, ["event"] = "stage", ["stage"] = "baking" });
    return _session.Baker;
  }

  async Task<CurrentVersion> VersionAsync(CancellationToken cancellationToken)
  {
    var now = DateTimeOffset.UtcNow;
    if (_version != null && now - _versionCheckedAt < VersionRecheck) return _version;
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    var versions = VersionService.Parse(
        await http.GetStringAsync(VersionService.VersionsUrl("wowf"), cancellationToken));
    _version = new(VersionService.ForRegion(versions, options.Region).VersionsName);
    _versionCheckedAt = now;
    return _version;
  }

  void Progress(string id, double fraction) =>
      Emit(new JsonObject { ["id"] = id, ["event"] = "progress", ["fraction"] = fraction });

  void Emit(JsonObject message)
  {
    lock (events)
    {
      events.WriteLine(message.ToJsonString());
      events.Flush();
    }
  }

  sealed record CurrentVersion(string Build);
}

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
