using System.Text.Json;
using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;
using T = GuildHub.ModelBaker.Tables.GameTableNames;

namespace GuildHub.ModelBaker.Bosses;

public sealed record BossModelAsset(string Path, string Metadata, int FileDataId);

/// <summary>
/// What the web app loads for one creature display: either a model with the skins it wears, or,
/// for a creature the game draws as a character, the baked look.
/// </summary>
public sealed record BossManifest(
    int SchemaVersion,
    string Build,
    int DisplayId,
    BossModelAsset? Model = null,
    string? TextureDirectory = null,
    IReadOnlyDictionary<int, int>? Textures = null,
    string? Look = null);

public sealed record BossBakeResult(IReadOnlyList<int> Baked, IReadOnlyList<int> Skipped);

/// <summary>
/// Bakes boss displays into the shared model store and writes one manifest per display.
/// </summary>
public sealed class BossBaker
{
  public const int OutputVersion = 1;
  public static readonly string Root = $"bosses/v{OutputVersion}";

  // A creature model's texture slots of types 11, 12 and 13 wear the display's variations in order.
  const int FirstVariationTextureType = 11;
  static readonly int[] StandAnimation = [0];

  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

  readonly IGameFiles _files;
  readonly ITables _tables;
  readonly string _build;
  readonly FixedLookBaker _looks;

  public BossBaker(IGameFiles files, ITables tables, string build)
  {
    _files = files;
    _tables = tables;
    _build = build;
    _looks = new(files, tables, build);
  }

  public static string ManifestPath(int displayId) => $"{Root}/{displayId}.json";

  public static string LookHash(int displayId) => $"boss-{displayId}";

  public BossBakeResult Bake(
      string outputDirectory,
      IReadOnlyList<int> displayIds,
      Action<string>? log = null,
      Action<double>? progress = null)
  {
    var store = new AssetStoreWriter(outputDirectory);
    var displays = _tables.Get(T.CreatureDisplayInfo).ById();
    var modelData = _tables.Get(T.CreatureModelData).ById();
    var npcs = new NpcLookReader(_tables);
    var paths = new AssetStorePaths(_build);
    var assets = new AssetConversionRunner(_files, paths);
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
      var manifest = displays.TryGetValue(displayId, out var display)
          ? BakeDisplay(display)
          : null;
      if (manifest == null)
      {
        log?.Invoke($"boss display {displayId} has no model; skipped");
        skipped.Add(displayId);
        continue;
      }
      store.WriteJson(ManifestPath(displayId), manifest);
      log?.Invoke($"boss display {displayId} -> {ManifestPath(displayId)}");
      baked.Add(displayId);
    }
    progress?.Invoke(1);
    return new(baked, skipped);

    BossManifest? BakeDisplay(Row display) => display.Int("ExtendedDisplayInfoID") == 0
        ? BakeCreature(store, paths, assets, modelData, display, log)
        : BakeCharacter(outputDirectory, npcs, display, log);
  }

  BossManifest? BakeCreature(
      AssetStoreWriter store,
      AssetStorePaths paths,
      AssetConversionRunner assets,
      Dictionary<int, Row> modelData,
      Row display,
      Action<string>? log)
  {
    if (!modelData.TryGetValue(display.Int("ModelID"), out var model)) return null;
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
    return new(
        OutputVersion,
        _build,
        display.Int("ID"),
        Model: new BossModelAsset(asset.Path, metadata, fileDataId),
        TextureDirectory: paths.TextureDirectory,
        Textures: textures);
  }

  BossManifest? BakeCharacter(string outputDirectory, NpcLookReader npcs, Row display, Action<string>? log)
  {
    if (npcs.Read(display.Int("ExtendedDisplayInfoID")) is not { } npc) return null;
    var displayId = display.Int("ID");
    var lookHash = LookHash(displayId);
    _looks.Bake(
        new FixedLookRequest(
            outputDirectory,
            npc.Race,
            npc.Sex,
            ItemIds: [],
            AnimationIds: StandAnimation,
            LookHash: lookHash,
            Customizations: npc.Customizations,
            ItemDisplays: npc.ItemDisplays),
        log);
    return new(OutputVersion, _build, displayId, Look: AssetStorePaths.ManifestPath(lookHash));
  }

  bool IsCurrent(AssetStoreWriter store, int displayId)
  {
    var path = ManifestPath(displayId);
    if (!store.Exists(path)) return false;
    var manifest = JsonSerializer.Deserialize<BossManifest>(store.Read(path), Json);
    return manifest?.Build == _build;
  }
}
