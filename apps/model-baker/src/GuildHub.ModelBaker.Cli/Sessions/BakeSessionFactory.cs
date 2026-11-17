using GuildHub.ModelBaker.Bosses;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Maps;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Cli.Sessions;

public static class BakeSessionFactory
{
  public static async Task<BakeSession> OpenAsync(
      string cacheDirectory,
      string region,
      TextWriter output,
      CancellationToken cancellationToken)
  {
    const string product = BuildVersionSource.Product;
    var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
    output.WriteLine($"Reading {product} {region} version metadata...");
    var entry = await BuildVersionSource.ReadAsync(http, region, cancellationToken);
    var cdns = VersionService.ParseCdns(
        await http.GetStringAsync(VersionService.CdnsUrl(product), cancellationToken),
        region);
    var source = new CdnSource(
        product,
        entry.Region,
        entry.BuildConfig,
        entry.CdnConfig,
        entry.VersionsName,
        cdns.Path);
    output.WriteLine($"Opening {product} build {source.Version}...");
    var storage = await GameStorage.OpenCdnAsync(
        source,
        Path.Combine(cacheDirectory, "tact"),
        cdns.Hosts,
        http,
        output.WriteLine);
    var definitions = new DefinitionProvider(Path.Combine(cacheDirectory, "definitions"));
    var tables = new Db2Tables(storage, definitions, source.Version, hotfixPath: null);
    return new BakeSession(
        http,
        new FixedLookBaker(storage, tables, source.Version),
        new WorldMapBaker(storage, tables, source.Version),
        new BossBaker(storage, tables, source.Version),
        source.Version);
  }
}
