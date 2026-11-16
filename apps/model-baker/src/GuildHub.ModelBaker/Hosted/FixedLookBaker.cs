// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Resolve;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Hosted;

public sealed class FixedLookBaker
{
  public static readonly int[] DefaultAnimationIds = [0, 67]; // Stand and EmoteWave preserve the CLI contract.
  public static readonly int[] TroopAnimationIds = [0, 4, 67, 115, 116, 119]; // Stand, Walk, EmoteWave, KneelStart, KneelLoop, StealthWalk.
  readonly AssetStorePaths _paths;
  readonly AssetConversionRunner _assets;
  readonly LookBakePlanner _planner;
  readonly LookManifestWriter _manifests;

  public FixedLookBaker(IGameFiles files, ITables tables, string build)
      : this(files, tables, build, new RequestedAnimationBakePolicy())
  {
  }

  public FixedLookBaker(
      IGameFiles files,
      ITables tables,
      string build,
      IAnimationBakePolicy animationPolicy)
  {
    _paths = new(build);
    _assets = new(files, _paths);
    _planner = new(tables, build, animationPolicy);
    _manifests = new(build);
  }

  public FixedLookManifest Bake(
      FixedLookRequest request,
      Action<string>? log = null,
      Action<double>? progress = null)
  {
    var steps = new BakeProgress(progress);
    var store = new AssetStoreWriter(request.OutputDirectory);
    var plan = _planner.Plan(request, log);

    var bodyAsset = _assets.ConvertModel(
        store,
        plan.BodyFileDataId,
        EmbeddedAnimationPolicy.StandAndGlobals,
        log);
    steps.Phase(BakeProgress.Body, 1, 1);
    var bodyMeta = _paths.MetadataPath(plan.BodyFileDataId);
    var bodyMetaBytes = store.Read(bodyMeta);
    var look = _planner.ResolveLook(request, bodyMetaBytes);

    var textureIds = new HashSet<int>(look.Layers.Select(l => l.FileDataId));
    textureIds.UnionWith(plan.Items.SelectMany(ResolvedItemAssets.TextureIds));
    var models = _assets.ConvertModels(store, ResolvedItemAssets.ModelIds(plan.Items), steps, log);
    textureIds.UnionWith(models.TextureIds);
    textureIds.UnionWith(AssetConverter.TextureIds(bodyMetaBytes));
    var items = ResolvedItemAssets.WithoutModels(plan.Items, models.Unavailable);
    _assets.ConvertTextures(store, textureIds, steps, log);

    var requestedAnimationIds = request.AnimationIds ?? DefaultAnimationIds;
    var selectedAnimationIds = _planner.SelectLookAnimations(
        request,
        requestedAnimationIds,
        plan.BodyFileDataId,
        bodyMetaBytes,
        log);
    var animations = _assets.ConvertAnimations(store, plan.BodyFileDataId, selectedAnimationIds, steps, log);
    if (requestedAnimationIds.Contains(0) && animations.All(a => a.Id != 0))
      throw new InvalidOperationException(
          $"Body {plan.BodyFileDataId} does not contain the Stand animation.");

    var manifest = _manifests.Write(store, request.LookHash, look, items, bodyAsset, bodyMeta, animations);
    steps.Phase(BakeProgress.Animations, 1, 1);
    return manifest;
  }

  /// <summary>
  /// Bakes everything a race and sex can look like before any gear: the body, its troop
  /// animations and the texture of every customization choice. Later looks of that body
  /// then only convert their items.
  /// </summary>
  public PrebakeResult Prebake(
      string outputDirectory,
      int race,
      int sex,
      IReadOnlyList<int> animationIds,
      Action<string>? log = null,
      Action<double>? progress = null)
  {
    var steps = new BakeProgress(progress);
    if (_planner.BodyFileDataId(race, sex) is not int bodyFileDataId)
    {
      log?.Invoke($"race {race}, sex {sex} has no HD body; skipped");
      return new(race, sex, 0, Baked: false);
    }
    var store = new AssetStoreWriter(outputDirectory);
    _assets.ConvertModel(store, bodyFileDataId, EmbeddedAnimationPolicy.StandAndGlobals, log);
    steps.Phase(BakeProgress.Body, 1, 1);
    var bodyMetaBytes = store.Read(_paths.MetadataPath(bodyFileDataId));
    var textureIds = _planner.PrebakeTextureIds(race, sex, bodyMetaBytes);
    steps.Phase(BakeProgress.Models, 1, 1);
    _assets.ConvertTextures(store, textureIds, steps, log);
    var selected = _planner.SelectAnimations(race, sex, animationIds, bodyMetaBytes);
    _assets.ConvertAnimations(store, bodyFileDataId, selected, steps, log);
    steps.Phase(BakeProgress.Animations, 1, 1);
    return new(race, sex, textureIds.Count, Baked: true);
  }

  public void BakeSharedFile(
      string outputDirectory,
      string kind,
      int fileId,
      int? modelFileId = null,
      int? animationId = null,
      Action<string>? log = null)
  {
    var store = new AssetStoreWriter(outputDirectory);
    switch (kind)
    {
      case "model":
        _ = _assets.ConvertModel(store, fileId, EmbeddedAnimationPolicy.AllSequencesAndGlobals, log);
        return;
      case "texture":
        _assets.ConvertRequiredTexture(store, fileId, log);
        return;
      case "animation":
        if (modelFileId is not int modelId || animationId is not int animId)
          throw new ArgumentException("Animation converts need --model-file-id and --animation-id.");
        _assets.ConvertRequiredAnimation(store, modelId, animId, log);
        return;
      default:
        throw new ArgumentOutOfRangeException(nameof(kind), kind, "Kind must be model, texture, or animation.");
    }
  }

  public static string ManifestPath(string? lookHash) => AssetStorePaths.ManifestPath(lookHash);

  public static ResolvedItem WithoutModels(ResolvedItem item, IReadOnlySet<int> unavailable) =>
      ResolvedItemAssets.WithoutModels(item, unavailable);
}
