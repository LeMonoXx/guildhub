using System.Diagnostics;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Resolve;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;
using Microsoft.Extensions.Logging;

namespace GuildHub.ModelBaker.Cli;

public static class CliApplication
{
  const string Usage = """
        GuildHub model baker

        Usage:
          GuildHub.ModelBaker.Cli --help
          GuildHub.ModelBaker.Cli bake-fixed [options]
          GuildHub.ModelBaker.Cli bake-look --look <file> [options]
          GuildHub.ModelBaker.Cli bake-looks --looks <dir> [options]
          GuildHub.ModelBaker.Cli bake-file --kind model|texture|animation --file-id <id> [options]
          GuildHub.ModelBaker.Cli bake-proof-scene rogue-t2 [options]

        bake-fixed options:
          --output <path>     Asset directory (default: assets/fixed)
          --cache <path>      TACT/definition cache (default: cache)
          --region <region>   Blizzard CDN region (default: eu)
          --race <id>         ChrRaces ID (default: 1)
          --sex <0|1>         0 male, 1 female (default: 0)
          --class <id>        ChrClasses ID, positive (default: 1)
          --item <id>         Equipped item; repeat for more than one
          --main-hand <id>    One-hand item forced into slot 16 / attachment 1
          --off-hand <id>     One-hand item forced into slot 17 / attachment 2
          --animation <id>    Body animation; repeat (default: Stand 0, EmoteWave 67)

        bake-look / bake-looks:
          --look <file>       One look.request.json from the API
          --looks <dir>       Directory of looks/{hash}/look.request.json
          Shared models write to builds/{build}/v{N}/...; the look JSON is looks/{hash}/look.json.
          Troop clips: Stand, Walk, EmoteWave, KneelStart, KneelLoop, StealthWalk.

        bake-file:
          --kind <kind>       model, texture, or animation
          --file-id <id>      FileDataID to convert
          --model-file-id <id>  Body FileDataID (animation only)
          --animation-id <id>   AnimationData ID (animation only)

        proof scenes:
          rogue-t2  Human male Rogue in Bloodfang with dual daggers and proof animations

        Commands read product wowf from Blizzard's CDN. Generated game assets stay
        in the gitignored output directory and must never be committed.
        """;

  public static async Task<int> RunAsync(
      IReadOnlyList<string> args,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken = default)
  {
    if (args.Count == 0 || args.Count == 1 && args[0] is "--help" or "-h")
    {
      output.WriteLine(Usage);
      return 0;
    }

    if (args[0] == "bake-fixed")
    {
      if (!FixedLookOptions.TryParse(args.Skip(1).ToArray(), out var options, out var message))
      {
        error.WriteLine(message);
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      return await BakeFixedAsync(options!, output, error, cancellationToken);
    }
    if (args[0] == "bake-look")
    {
      if (!LookCommandOptions.TryParse(args.Skip(1).ToArray(), out var options, out var message)
          || options?.LookFile is null)
      {
        error.WriteLine(message ?? "Missing --look <file>.");
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      return await BakeLookFileAsync(options.LookFile, options, output, error, cancellationToken);
    }
    if (args[0] == "bake-looks")
    {
      if (!LookCommandOptions.TryParse(args.Skip(1).ToArray(), out var options, out var message)
          || options?.LooksDirectory is null)
      {
        error.WriteLine(message ?? "Missing --looks <dir>.");
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      return await BakeLooksDirectoryAsync(options, output, error, cancellationToken);
    }
    if (args[0] == "bake-file")
    {
      if (!FileCommandOptions.TryParse(args.Skip(1).ToArray(), out var options, out var message))
      {
        error.WriteLine(message);
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      return await BakeSharedFileAsync(options!, output, error, cancellationToken);
    }
    if (args[0] == "bake-proof-scene")
    {
      if (args.Count < 2 || !ProofSceneCatalog.TryGet(args[1], out var scene))
      {
        error.WriteLine(args.Count < 2
            ? "Missing proof scene name."
            : $"Unknown proof scene: {args[1]}");
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      if (!FixedLookOptions.TryParse(
          args.Skip(2).ToArray(),
          scene!.Options,
          out var options,
          out var message))
      {
        error.WriteLine(message);
        error.WriteLine("Run with --help for usage.");
        return 2;
      }
      return await BakeFixedAsync(options!, output, error, cancellationToken);
    }

    error.WriteLine($"Unknown argument: {args[0]}");
    error.WriteLine("Run with --help for usage.");
    return 2;
  }

  static async Task<int> BakeFixedAsync(
      FixedLookOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    try
    {
      await using var session = await OpenSessionAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      var manifest = session.Baker.Bake(
          new(
              options.OutputDirectory,
              options.Race,
              options.Sex,
              options.ItemIds,
              options.AnimationIds,
              options.ClassId,
              options.EquipmentOverrides),
          output.WriteLine);
      output.WriteLine(
          $"Fixed look ready: {Path.Combine(options.OutputDirectory, "looks", "fixed", "look.json")}");
      output.WriteLine(
          $"Build {manifest.Build}, {manifest.Items.Count} items, {manifest.Animations.Count} animations.");
      return 0;
    }
    catch (Exception exception)
    {
      error.WriteLine($"Bake failed: {exception.Message}");
      return 1;
    }
  }

  static async Task<int> BakeLookFileAsync(
      string lookFile,
      LookCommandOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    try
    {
      var document = LookBakeDocument.Parse(await File.ReadAllTextAsync(lookFile, cancellationToken));
      await using var session = await OpenSessionAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      var request = document.ToRequest(options.OutputDirectory);
      var manifest = session.Baker.Bake(request, output.WriteLine);
      output.WriteLine(
          $"Look ready: {Path.Combine(options.OutputDirectory, FixedLookBaker.ManifestPath(request.LookHash))}");
      output.WriteLine(
          $"Build {manifest.Build}, {manifest.Items.Count} items, {manifest.Animations.Count} animations.");
      return 0;
    }
    catch (Exception exception)
    {
      error.WriteLine($"Bake failed: {exception.Message}");
      return 1;
    }
  }

  static async Task<int> BakeLooksDirectoryAsync(
      LookCommandOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    var looksRoot = options.LooksDirectory!;
    if (!Directory.Exists(looksRoot))
    {
      error.WriteLine($"Looks directory not found: {looksRoot}");
      return 2;
    }
    var files = Directory.GetFiles(looksRoot, "look.request.json", SearchOption.AllDirectories)
        .OrderBy(path => path, StringComparer.Ordinal)
        .ToList();
    if (files.Count == 0)
    {
      error.WriteLine($"No look.request.json files under {looksRoot}.");
      return 2;
    }
    try
    {
      await using var session = await OpenSessionAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      var baked = 0;
      var failed = 0;
      foreach (var file in files)
      {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
          var document = LookBakeDocument.Parse(await File.ReadAllTextAsync(file, cancellationToken));
          var request = document.ToRequest(options.OutputDirectory);
          var manifestPath = Path.Combine(
              options.OutputDirectory,
              FixedLookBaker.ManifestPath(request.LookHash).Replace('/', Path.DirectorySeparatorChar));
          if (File.Exists(manifestPath))
          {
            output.WriteLine($"Look {request.LookHash} exists, skipped");
            continue;
          }
          var manifest = session.Baker.Bake(request, output.WriteLine);
          output.WriteLine(
              $"Look ready: {manifestPath} ({manifest.Items.Count} items, {manifest.Animations.Count} animations)");
          baked++;
        }
        catch (Exception exception)
        {
          failed++;
          error.WriteLine($"Bake failed for {file}: {exception.Message}");
        }
      }
      output.WriteLine($"Baked {baked} of {files.Count} looks.");
      return failed == 0 ? 0 : 1;
    }
    catch (Exception exception)
    {
      error.WriteLine($"Bake failed: {exception.Message}");
      return 1;
    }
  }

  static async Task<int> BakeSharedFileAsync(
      FileCommandOptions options,
      TextWriter output,
      TextWriter error,
      CancellationToken cancellationToken)
  {
    try
    {
      await using var session = await OpenSessionAsync(
          options.CacheDirectory,
          options.Region,
          output,
          cancellationToken);
      session.Baker.BakeSharedFile(
          options.OutputDirectory,
          options.Kind,
          options.FileId,
          options.ModelFileId,
          options.AnimationId,
          output.WriteLine);
      return 0;
    }
    catch (Exception exception)
    {
      error.WriteLine($"Bake failed: {exception.Message}");
      return 1;
    }
  }

  static async Task<BakeSession> OpenSessionAsync(
      string cacheDirectory,
      string region,
      TextWriter output,
      CancellationToken cancellationToken)
  {
    var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
    output.WriteLine($"Reading wowf {region} version metadata...");
    var versions = VersionService.Parse(
        await http.GetStringAsync(VersionService.VersionsUrl("wowf"), cancellationToken));
    var entry = VersionService.ForRegion(versions, region);
    var cdns = VersionService.ParseCdns(
        await http.GetStringAsync(VersionService.CdnsUrl("wowf"), cancellationToken),
        region);
    var source = new CdnSource(
        "wowf",
        entry.Region,
        entry.BuildConfig,
        entry.CdnConfig,
        entry.VersionsName,
        cdns.Path);
    output.WriteLine($"Opening wowf build {source.Version}...");
    var storage = await GameStorage.OpenCdnAsync(
        source,
        Path.Combine(cacheDirectory, "tact"),
        cdns.Hosts,
        http,
        output.WriteLine);
    var definitions = new DefinitionProvider(Path.Combine(cacheDirectory, "definitions"));
    var tables = new Db2Tables(storage, definitions, source.Version, hotfixPath: null);
    return new BakeSession(http, new FixedLookBaker(storage, tables, source.Version));
  }
}

public sealed class BakeSession(
    HttpClient http,
    FixedLookBaker baker) : IAsyncDisposable
{
  public FixedLookBaker Baker { get; } = baker;

  public ValueTask DisposeAsync()
  {
    http.Dispose();
    return ValueTask.CompletedTask;
  }
}

public sealed record FixedLookOptions(
    string OutputDirectory,
    string CacheDirectory,
    string Region,
    int Race,
    int Sex,
    IReadOnlyList<int> ItemIds,
    IReadOnlyList<int> AnimationIds,
    int ClassId = LookResolver.DefaultClassId,
    IReadOnlyList<EquipmentSlotOverride>? EquipmentOverrides = null)
{
  static readonly int[] DefaultItems = [16820, 19019];
  static readonly int[] DefaultAnimations = [0, 67];

  public static bool TryParse(
      IReadOnlyList<string> args,
      out FixedLookOptions? options,
      out string? error)
      => TryParse(args, defaults: null, out options, out error);

  public static bool TryParse(
      IReadOnlyList<string> args,
      FixedLookOptions? defaults,
      out FixedLookOptions? options,
      out string? error)
  {
    var output = defaults?.OutputDirectory
        ?? Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "fixed"));
    var cache = defaults?.CacheDirectory
        ?? Path.GetFullPath(Path.Combine("apps", "model-baker", "cache"));
    var region = defaults?.Region ?? "eu";
    var race = defaults?.Race ?? 1;
    var sex = defaults?.Sex ?? 0;
    var classId = defaults?.ClassId ?? LookResolver.DefaultClassId;
    var items = defaults?.ItemIds.ToList() ?? [];
    var animations = defaults?.AnimationIds.ToList() ?? [];
    var equipmentOverrides = defaults?.EquipmentOverrides?.ToList() ?? [];
    var hasItems = defaults != null;
    var hasAnimations = defaults != null;

    for (var index = 0; index < args.Count; index++)
    {
      var name = args[index];
      if (index + 1 >= args.Count)
      {
        options = null;
        error = $"Missing value for {name}.";
        return false;
      }
      var value = args[++index];
      switch (name)
      {
        case "--output":
          output = Path.GetFullPath(value);
          break;
        case "--cache":
          cache = Path.GetFullPath(value);
          break;
        case "--region":
          region = value;
          break;
        case "--race" when int.TryParse(value, out var parsedRace) && parsedRace > 0:
          race = parsedRace;
          break;
        case "--sex" when int.TryParse(value, out var parsedSex) && parsedSex is 0 or 1:
          sex = parsedSex;
          break;
        case "--class" when int.TryParse(value, out var parsedClass) && parsedClass > 0:
          classId = parsedClass;
          break;
        case "--item" when int.TryParse(value, out var item) && item > 0:
          items.Add(item);
          hasItems = true;
          break;
        case "--main-hand" when int.TryParse(value, out var mainHand) && mainHand > 0:
          if (equipmentOverrides.Any(item => item.EquipSlot == ItemResolver.MainHandSlot))
          {
            options = null;
            error = $"Conflicting duplicate equipment slot override for slot {ItemResolver.MainHandSlot}.";
            return false;
          }
          items.Add(mainHand);
          equipmentOverrides.Add(new(mainHand, ItemResolver.MainHandSlot));
          hasItems = true;
          break;
        case "--off-hand" when int.TryParse(value, out var offHand) && offHand > 0:
          if (equipmentOverrides.Any(item => item.EquipSlot == ItemResolver.OffHandSlot))
          {
            options = null;
            error = $"Conflicting duplicate equipment slot override for slot {ItemResolver.OffHandSlot}.";
            return false;
          }
          items.Add(offHand);
          equipmentOverrides.Add(new(offHand, ItemResolver.OffHandSlot));
          hasItems = true;
          break;
        case "--animation" when int.TryParse(value, out var animation) && animation >= 0:
          animations.Add(animation);
          hasAnimations = true;
          break;
        default:
          options = null;
          error = $"Invalid option or value: {name} {value}.";
          return false;
      }
    }

    options = new(
        output,
        cache,
        region,
        race,
        sex,
        hasItems ? items : DefaultItems,
        hasAnimations ? animations : DefaultAnimations,
        classId,
        equipmentOverrides);
    error = null;
    return true;
  }
}

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
    var output = Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "fixed"));
    var cache = Path.GetFullPath(Path.Combine("apps", "model-baker", "cache"));
    var region = "eu";
    string? lookFile = null;
    string? looksDirectory = null;
    for (var index = 0; index < args.Count; index++)
    {
      var name = args[index];
      if (index + 1 >= args.Count)
      {
        options = null;
        error = $"Missing value for {name}.";
        return false;
      }
      var value = args[++index];
      switch (name)
      {
        case "--output":
          output = Path.GetFullPath(value);
          break;
        case "--cache":
          cache = Path.GetFullPath(value);
          break;
        case "--region":
          region = value;
          break;
        case "--look":
          lookFile = Path.GetFullPath(value);
          break;
        case "--looks":
          looksDirectory = Path.GetFullPath(value);
          break;
        default:
          options = null;
          error = $"Invalid option or value: {name} {value}.";
          return false;
      }
    }
    options = new(output, cache, region, lookFile, looksDirectory);
    error = null;
    return true;
  }
}

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
    var output = Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "fixed"));
    var cache = Path.GetFullPath(Path.Combine("apps", "model-baker", "cache"));
    var region = "eu";
    string? kind = null;
    int? fileId = null;
    int? modelFileId = null;
    int? animationId = null;
    for (var index = 0; index < args.Count; index++)
    {
      var name = args[index];
      if (index + 1 >= args.Count)
      {
        options = null;
        error = $"Missing value for {name}.";
        return false;
      }
      var value = args[++index];
      switch (name)
      {
        case "--output":
          output = Path.GetFullPath(value);
          break;
        case "--cache":
          cache = Path.GetFullPath(value);
          break;
        case "--region":
          region = value;
          break;
        case "--kind" when value is "model" or "texture" or "animation":
          kind = value;
          break;
        case "--file-id" when int.TryParse(value, out var parsedFile) && parsedFile > 0:
          fileId = parsedFile;
          break;
        case "--model-file-id" when int.TryParse(value, out var parsedModel) && parsedModel > 0:
          modelFileId = parsedModel;
          break;
        case "--animation-id" when int.TryParse(value, out var parsedAnim) && parsedAnim >= 0:
          animationId = parsedAnim;
          break;
        default:
          options = null;
          error = $"Invalid option or value: {name} {value}.";
          return false;
      }
    }
    if (kind is null || fileId is null)
    {
      options = null;
      error = "bake-file requires --kind and --file-id.";
      return false;
    }
    options = new(output, cache, region, kind, fileId.Value, modelFileId, animationId);
    error = null;
    return true;
  }
}

public sealed record ProofScene(string Name, FixedLookOptions Options);

public static class ProofSceneCatalog
{
  public static readonly ProofScene RogueTier2 = new(
      "rogue-t2",
      new(
          Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "proof", "rogue-t2")),
          Path.GetFullPath(Path.Combine("apps", "model-baker", "cache")),
          "eu",
          1,
          0,
          [16908, 16832, 16905, 16911, 16907, 16910, 16909, 16906, 18816, 18805],
          [0, 4, 5, 26, 32, 54, 114, 115, 116, 119, 120, 123, 128, 129, 224],
          4,
          [
              new(18816, ItemResolver.MainHandSlot),
                new(18805, ItemResolver.OffHandSlot),
          ]));

  public static bool TryGet(string name, out ProofScene? scene)
  {
    scene = string.Equals(name, RogueTier2.Name, StringComparison.OrdinalIgnoreCase)
        ? RogueTier2
        : null;
    return scene != null;
  }
}

public static class Program
{
  public static async Task<int> Main(string[] args)
  {
    using var observability = Observability.Create();
    using var activity = Observability.Activities.StartActivity("baker.cli");
    var exitCode = await CliApplication.RunAsync(
        args,
        Console.Out,
        Console.Error);
    if (exitCode != 0)
    {
      activity?.SetStatus(ActivityStatusCode.Error, "invalid command");
      observability.LoggerFactory.CreateLogger("GuildHub.ModelBaker.Cli")
          .LogWarning("Baker command rejected with exit code {ExitCode}", exitCode);
    }
    return exitCode;
  }
}
