using System.Text.Json;
using System.Text.Json.Nodes;
using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Serve;

/// <summary>
/// One long-lived baker: requests arrive as JSON lines on stdin, events leave as JSON
/// lines on stdout, and human logs go to stderr. The game storage opens on the first
/// request that needs it and stays open, so later looks skip the CDN indexes and tables.
/// Closing stdin ends the process; the caller decides how long an idle baker may live.
/// </summary>
public sealed class ServeCommand
{
  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

  readonly ServeOptions _options;
  readonly TextWriter _log;
  readonly ServeProtocol _protocol;
  readonly ServeSessionHost _sessions;

  public ServeCommand(
      ServeOptions options,
      TextReader input,
      TextWriter events,
      TextWriter log)
  {
    _options = options;
    _log = log;
    _protocol = new(input, events);
    _sessions = new(options, log);
  }

  public async Task<int> RunAsync(CancellationToken cancellationToken)
  {
    _protocol.Ready();
    try
    {
      while (await _protocol.ReadLineAsync(cancellationToken) is { } line)
        await HandleAsync(line, cancellationToken);
      return 0;
    }
    finally
    {
      await _sessions.DisposeAsync();
    }
  }

  async Task HandleAsync(string line, CancellationToken cancellationToken)
  {
    string? id = null;
    try
    {
      var request = ServeProtocol.ParseRequest(line);
      id = ServeProtocol.RequestId(request);
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
      _protocol.Done(id, result);
    }
    catch (Exception exception) when (exception is not OperationCanceledException)
    {
      _log.WriteLine($"Bake failed: {exception.Message}");
      _protocol.Failed(id, exception.Message);
    }
  }

  async Task<JsonNode> BuildAsync(CancellationToken cancellationToken)
  {
    var build = await _sessions.CurrentBuildAsync(cancellationToken);
    return new JsonObject { ["build"] = build };
  }

  async Task<JsonNode> LookAsync(string id, JsonObject request, CancellationToken cancellationToken)
  {
    var raw = request["look"]?.ToJsonString()
        ?? throw new InvalidOperationException("A look request needs a look.");
    var bake = LookBakeDocument.Parse(raw).ToRequest(_options.OutputDirectory);
    var baker = await BakerAsync(id, cancellationToken);
    var manifest = baker.Bake(bake, _log.WriteLine, fraction => _protocol.Progress(id, fraction));
    return new JsonObject
    {
      ["build"] = manifest.Build,
      ["manifest"] = AssetStorePaths.ManifestPath(bake.LookHash),
    };
  }

  async Task<JsonNode> FixedAsync(string id, CancellationToken cancellationToken)
  {
    var fixedOptions = FixedLookOptions.Default(
        new(_options.OutputDirectory, _options.CacheDirectory, _options.Region));
    var baker = await BakerAsync(id, cancellationToken);
    var result = FixedLookBakeRunner.Run(
        baker,
        fixedOptions,
        _log.WriteLine,
        fraction => _protocol.Progress(id, fraction));
    return new JsonObject
    {
      ["build"] = result.Manifest.Build,
      ["manifest"] = result.ManifestPath,
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
        _options.OutputDirectory,
        kind,
        fileId,
        request["modelFileId"]?.GetValue<int>(),
        request["animationId"]?.GetValue<int>(),
        _log.WriteLine);
    return new JsonObject { ["build"] = _sessions.SessionBuild };
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
    var build = await _sessions.CurrentBuildAsync(cancellationToken);
    var marker = AssetStorePaths.PrebakeMarkerFile(_options.OutputDirectory, build, race, sex);
    if (File.Exists(marker))
      return new JsonObject { ["build"] = build, ["skipped"] = true };
    var baker = await BakerAsync(id, cancellationToken);
    var result = baker.Prebake(
        _options.OutputDirectory,
        race,
        sex,
        FixedLookBaker.TroopAnimationIds,
        _log.WriteLine,
        fraction => _protocol.Progress(id, fraction));
    Directory.CreateDirectory(Path.GetDirectoryName(marker)!);
    await File.WriteAllTextAsync(marker, JsonSerializer.Serialize(result, Json), cancellationToken);
    return new JsonObject
    {
      ["build"] = _sessions.SessionBuild,
      ["baked"] = result.Baked,
      ["textures"] = result.Textures,
    };
  }

  Task<FixedLookBaker> BakerAsync(string id, CancellationToken cancellationToken) =>
      _sessions.BakerAsync(stage => _protocol.Stage(id, stage), cancellationToken);
}
