using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli.Sessions;

/// <summary>
/// The product's current build in a region, from Blizzard's version service.
/// </summary>
public static class BuildVersionSource
{
  public const string Product = "wowf";
  static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(30);

  public static async Task<VersionEntry> ReadAsync(
      HttpClient http,
      string region,
      CancellationToken cancellationToken)
  {
    var versions = VersionService.Parse(
        await http.GetStringAsync(VersionService.VersionsUrl(Product), cancellationToken));
    return VersionService.ForRegion(versions, region);
  }

  public static async Task<VersionEntry> ReadAsync(string region, CancellationToken cancellationToken)
  {
    using var http = new HttpClient { Timeout = CheckTimeout };
    return await ReadAsync(http, region, cancellationToken);
  }
}
