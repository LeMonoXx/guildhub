using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace GuildHub.ModelBaker.Cli;

public static class Program
{
  public static async Task<int> Main(string[] args)
  {
    using var observability = Observability.Create();
    using var activity = Observability.Activities.StartActivity("baker.cli");
    var exitCode = await CliApplication.RunAsync(
        CliCommandRegistry.Default,
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
