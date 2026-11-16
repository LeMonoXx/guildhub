using System.Text.Json.Nodes;
using GuildHub.ModelBaker.Cli;

namespace GuildHub.ModelBaker.Tests;

public class ServeCommandTests
{
  [Fact]
  public async Task AnswersEveryLineAndEndsWhenStdinCloses()
  {
    var input = new StringReader(string.Join('\n',
        "not json",
        "",
        """{"id":"7","command":"unknown"}""",
        """{"command":"look"}"""));
    var events = new StringWriter();
    var log = new StringWriter();
    var serve = new ServeCommand(new("out", "cache", "eu"), input, events, log);

    var exitCode = await serve.RunAsync(CancellationToken.None);

    Assert.Equal(0, exitCode);
    var lines = events.ToString()
        .Split('\n', StringSplitOptions.RemoveEmptyEntries)
        .Select(line => JsonNode.Parse(line)!.AsObject())
        .ToList();
    Assert.Equal(["ready", "failed", "failed", "failed"], lines.Select(e => e["event"]!.GetValue<string>()));
    Assert.Null(lines[1]["id"]);
    Assert.Equal("7", lines[2]["id"]!.GetValue<string>());
    Assert.Contains("Unknown command", lines[2]["message"]!.GetValue<string>());
    Assert.Contains("needs an id", lines[3]["message"]!.GetValue<string>());
  }

  [Fact]
  public void ServeTakesNoLookFiles()
  {
    Assert.False(ServeOptions.TryParse(["--look", "a.json"], out _, out var error));
    Assert.Contains("stdin", error);
    Assert.True(ServeOptions.TryParse(["--region", "us"], out var options, out _));
    Assert.Equal("us", options!.Region);
  }
}
