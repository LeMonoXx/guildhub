namespace GuildHub.ModelBaker.Cli;

public static class CliUsage
{
  public const string Text = """
        GuildHub model baker

        Usage:
          GuildHub.ModelBaker.Cli --help
          GuildHub.ModelBaker.Cli bake-fixed [options]
          GuildHub.ModelBaker.Cli bake-look --look <file> [options]
          GuildHub.ModelBaker.Cli bake-looks --looks <dir> [options]
          GuildHub.ModelBaker.Cli bake-file --kind model|texture|animation --file-id <id> [options]
          GuildHub.ModelBaker.Cli bake-world-map [--output <path>] [--cache <path>] [--region <region>]
          GuildHub.ModelBaker.Cli bake-proof-scene rogue-t2 [options]
          GuildHub.ModelBaker.Cli serve [--output <path>] [--cache <path>] [--region <region>]

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

        serve:
          Reads one JSON request per line on stdin and answers with JSON events on stdout:
            {"id":"1","command":"look","look":{...look.request.json...}}
            {"id":"2","command":"fixed"}
            {"id":"3","command":"file","kind":"texture","fileId":123}
            {"id":"4","command":"prebake","race":2,"sex":0}
            {"id":"5","command":"build"}
            {"id":"6","command":"worldmap"}
          Events: ready, stage (opening, baking), progress (fraction 0..1), done, failed.
          Logs go to stderr. The game storage stays open until stdin closes.

        Commands read product wowf from Blizzard's CDN. Generated game assets stay
        in the gitignored output directory and must never be committed.
        """;

  // Exit code 2: the command line was rejected before any bake started.
  public static int Reject(TextWriter error, string? message)
  {
    error.WriteLine(message);
    error.WriteLine("Run with --help for usage.");
    return 2;
  }
}
