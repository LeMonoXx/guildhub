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

        proof scenes:
          rogue-t2  Human male Rogue in Bloodfang with dual daggers and proof animations

        bake-fixed reads product wowf from Blizzard's CDN. Generated game assets stay
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
      using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
      output.WriteLine($"Reading wowf {options.Region} version metadata...");
      var versions = VersionService.Parse(
          await http.GetStringAsync(
              VersionService.VersionsUrl("wowf"),
              cancellationToken));
      var entry = VersionService.ForRegion(versions, options.Region);
      var cdns = VersionService.ParseCdns(
          await http.GetStringAsync(
              VersionService.CdnsUrl("wowf"),
              cancellationToken),
          options.Region);
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
          Path.Combine(options.CacheDirectory, "tact"),
          cdns.Hosts,
          http,
          output.WriteLine);
      var definitions = new DefinitionProvider(
          Path.Combine(options.CacheDirectory, "definitions"));
      var tables = new Db2Tables(
          storage,
          definitions,
          source.Version,
          hotfixPath: null);
      var manifest = new FixedLookBaker(
          storage,
          tables,
          source.Version).Bake(
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
