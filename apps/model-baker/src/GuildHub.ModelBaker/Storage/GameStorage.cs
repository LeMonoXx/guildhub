// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using TACTSharp;

namespace GuildHub.ModelBaker.Storage;

public interface IGameFiles
{
    // Throws FileNotFoundException when the file is not in the local install.
    byte[] Open(uint fileDataId);

    // Whether the build lists the file at all.
    bool Exists(uint fileDataId);
}

// CDN-only view of one product's CASC storage. Local install discovery intentionally stays out of
// GuildHub's baker.
public sealed class GameStorage : IGameFiles
{
    readonly BuildInstance _build;
    readonly Lock _lock = new();

    GameStorage(BuildInstance build, string buildName)
    {
        _build = build;
        BuildName = buildName;
    }

    public string BuildName { get; }

    // Reads every file from Blizzard's CDN, caching under tactCacheDir.
    public static BuildInstance CreateCdnBuild(CdnSource source, string tactCacheDir)
    {
        Settings.LogLevel = TSLogLevel.Warn;
        var build = new BuildInstance();
        build.Settings.Product = source.Product;
        build.Settings.Region = source.Region;
        build.Settings.TryCDN = true;
        build.Settings.ListfileFallback = false;
        build.Settings.CacheDir = tactCacheDir;
        build.Settings.RootMode = RootInstance.LoadMode.Full;
        return build;
    }

    // NOT RUN by any test or by the local app: this downloads the build's indexes (tens of MB) and then
    // each file it is asked for. Only the hosted pipeline calls it. The indexes come first through
    // CdnIndexPrefetch, a few at a time, because TACTSharp requests them all at once and those requests stall.
    public static async Task<GameStorage> OpenCdnAsync(CdnSource source, string tactCacheDir, IReadOnlyList<string> hosts, HttpClient http, Action<string>? log = null)
    {
        Directory.CreateDirectory(tactCacheDir);
        var build = CreateCdnBuild(source, tactCacheDir);
        build.Settings.AdditionalCDNs.AddRange(hosts);
        build.cdn.ProductDirectory = source.CdnPath;
        build.LoadConfigs(source.BuildConfig, source.CdnConfig);
        var archives = build.CDNConfig!.Values["archives"];
        var fetched = await CdnIndexPrefetch.RunAsync(http, hosts, source.CdnPath, archives, tactCacheDir);
        log?.Invoke($"{archives.Length} archive indexes ready ({fetched} downloaded).");
        build.Load();
        return new GameStorage(build, build.BuildConfig!.Values["build-name"][0]);
    }

    // TACTSharp does not document thread safety.
    public byte[] Open(uint fileDataId)
    {
        lock (_lock) return LocalFiles.Open(_build, fileDataId).bytes;
    }

    public bool Exists(uint fileDataId)
    {
        lock (_lock) return _build.Root!.FileExists(fileDataId);
    }
}
