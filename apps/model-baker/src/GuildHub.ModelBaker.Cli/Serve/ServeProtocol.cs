using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Cli.Serve;

/// <summary>
/// The serve wire format: one JSON request per input line, one JSON event per output line.
/// </summary>
public sealed class ServeProtocol(TextReader input, TextWriter events)
{
  // Null once input closes; blank lines are not requests.
  public async Task<string?> ReadLineAsync(CancellationToken cancellationToken)
  {
    while (await input.ReadLineAsync(cancellationToken) is { } line)
    {
      if (string.IsNullOrWhiteSpace(line)) continue;
      return line;
    }
    return null;
  }

  public static JsonObject ParseRequest(string line) =>
      JsonNode.Parse(line)?.AsObject()
          ?? throw new InvalidOperationException("A request must be a JSON object.");

  public static string RequestId(JsonObject request) =>
      request["id"]?.GetValue<string>()
          ?? throw new InvalidOperationException("A request needs an id.");

  public void Ready() => Emit(new JsonObject { ["event"] = "ready" });

  public void Stage(string id, string stage) =>
      Emit(new JsonObject { ["id"] = id, ["event"] = "stage", ["stage"] = stage });

  public void Progress(string id, double fraction) =>
      Emit(new JsonObject { ["id"] = id, ["event"] = "progress", ["fraction"] = fraction });

  public void Done(string id, JsonNode result) =>
      Emit(new JsonObject { ["id"] = id, ["event"] = "done", ["result"] = result });

  public void Failed(string? id, string message) =>
      Emit(new JsonObject
      {
        ["id"] = id,
        ["event"] = "failed",
        ["message"] = message,
      });

  void Emit(JsonObject message)
  {
    lock (events)
    {
      events.WriteLine(message.ToJsonString());
      events.Flush();
    }
  }
}
