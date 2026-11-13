using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace GuildHub.ModelBaker.Cli;

public static class CliApplication
{
    const string Usage = """
        GuildHub model baker — Milestone A Phase 1

        Usage:
          GuildHub.ModelBaker.Cli --help

        The converter core is installed and tested. Fixed-look baking arrives in Phase 2;
        this Phase 1 executable does not access the network or produce game assets.
        """;

    public static int Run(IReadOnlyList<string> args, TextWriter output, TextWriter error)
    {
        if (args.Count == 0 || args.Count == 1 && args[0] is "--help" or "-h")
        {
            output.WriteLine(Usage);
            return 0;
        }

        error.WriteLine($"Unknown argument: {args[0]}");
        error.WriteLine("Run with --help for usage. Fixed-look baking arrives in Phase 2.");
        return 2;
    }
}

public static class Program
{
    public static int Main(string[] args)
    {
        using var observability = Observability.Create();
        using var activity = Observability.Activities.StartActivity("baker.cli");
        var exitCode = CliApplication.Run(args, Console.Out, Console.Error);
        if (exitCode != 0)
        {
            activity?.SetStatus(ActivityStatusCode.Error, "invalid command");
            observability.LoggerFactory.CreateLogger("GuildHub.ModelBaker.Cli")
                .LogWarning("Baker command rejected with exit code {ExitCode}", exitCode);
        }
        return exitCode;
    }
}
