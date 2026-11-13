using System.Diagnostics;
using GuildHub.ModelBaker.Hosted;
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

        bake-fixed options:
          --output <path>   Asset directory (default: assets/fixed)
          --cache <path>    TACT/definition cache (default: cache)
          --region <region> Blizzard CDN region (default: eu)
          --race <id>       ChrRaces ID (default: 1)
          --sex <0|1>       0 male, 1 female (default: 0)
          --item <id>       Equipped item; repeat for more than one

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
                        options.ItemIds),
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
    IReadOnlyList<int> ItemIds)
{
    static readonly int[] DefaultItems = [16820, 19019];

    public static bool TryParse(
        IReadOnlyList<string> args,
        out FixedLookOptions? options,
        out string? error)
    {
        var output = Path.GetFullPath(Path.Combine("apps", "model-baker", "assets", "fixed"));
        var cache = Path.GetFullPath(Path.Combine("apps", "model-baker", "cache"));
        var region = "eu";
        var race = 1;
        var sex = 0;
        var items = new List<int>();

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
                case "--item" when int.TryParse(value, out var item) && item > 0:
                    items.Add(item);
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
            items.Count > 0 ? items : DefaultItems);
        error = null;
        return true;
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
