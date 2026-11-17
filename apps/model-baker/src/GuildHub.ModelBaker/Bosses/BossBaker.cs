using System.Text.Json;
using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;
using T = GuildHub.ModelBaker.Tables.GameTableNames;

namespace GuildHub.ModelBaker.Bosses;

public sealed record BossModelAsset(string Path, string Metadata, int FileDataId);

/// <summary>What the web app loads for one creature display: its model and the skins it wears.</summary>
public sealed record BossManifest(
    int SchemaVersion,
    string Build,
    int DisplayId,
    BossModelAsset Model,
    string TextureDirectory,
    IReadOnlyDictionary<int, int> Textures);

public sealed record BossBakeResult(IReadOnlyList<int> Baked, IReadOnlyList<int> Skipped);

/// <summary>
/// Bakes creature displays (models whose look comes from the display, not from a character)
/// into the shared model store and writes one manifest per display.
/// </summary>
public sealed class BossBaker(IGameFiles files, ITables tables, string build)
{
  public const int OutputVersion = 1;
  public static readonly string Root = $"bosses/v{OutputVersion}";

  // A creature model's texture slots of types 11, 12 and 13 wear the display's variations in order.
  const int FirstVariationTextureType = 11;

  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

  public static string ManifestPath(int displayId) => $"{Root}/{displayId}.json";

  public BossBakeResult Bake(
      string outputDirectory,
      IReadOnlyList<int> displayIds,
      Action<string>? log = null,
      Action<double>? progress = null)
  {
    var store = new AssetStoreWriter(outputDirectory);
    var paths = new AssetStorePaths(build);
    var assets = new AssetConversionRunner(files, paths);
    var displays = tables.Get(T.CreatureDisplayInfo).ById();
    var modelData = tables.Get(T.CreatureModelData).ById();
    var baked = new List<int>();
    var skipped = new List<int>();
    var done = 0;
    foreach (var displayId in displayIds.Distinct())
    {
      progress?.Invoke(done++ / (double)Math.Max(displayIds.Count, 1));
      if (IsCurrent(store, displayId))
      {
        baked.Add(displayId);
        continue;
      }
      if (!displays.TryGetValue(displayId, out var display) ||
          display.Int("ExtendedDisplayInfoID") != 0 ||
          !modelData.TryGetValue(display.Int("ModelID"), out var model))
      {
        log?.Invoke($"boss display {displayId} is no creature display; skipped");
        skipped.Add(displayId);
        continue;
      }
      var fileDataId = model.Int("FileDataID");
      var asset = assets.ConvertModel(store, fileDataId, EmbeddedAnimationPolicy.StandAndGlobals, log);
      var metadata = paths.MetadataPath(fileDataId);
      var textures = display.Ints("TextureVariationFileDataID")
          .Select((textureId, index) => (Type: FirstVariationTextureType + index, Id: textureId))
          .Where(variation => variation.Id != 0)
          .ToDictionary(variation => variation.Type, variation => variation.Id);
      var textureIds = new HashSet<int>(textures.Values);
      textureIds.UnionWith(AssetConverter.TextureIds(store.Read(metadata)));
      assets.ConvertTextures(store, textureIds, new BakeProgress(null), log);
      store.WriteJson(
          ManifestPath(displayId),
          new BossManifest(
              OutputVersion,
              build,
              displayId,
              new BossModelAsset(asset.Path, metadata, fileDataId),
              paths.TextureDirectory,
              textures));
      log?.Invoke($"boss display {displayId} -> {ManifestPath(displayId)}");
      baked.Add(displayId);
    }
    progress?.Invoke(1);
    return new(baked, skipped);
  }

  bool IsCurrent(AssetStoreWriter store, int displayId)
  {
    var path = ManifestPath(displayId);
    if (!store.Exists(path)) return false;
    var manifest = JsonSerializer.Deserialize<BossManifest>(store.Read(path), Json);
    return manifest?.Build == build;
  }
}
