// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json;
using GuildHub.ModelBaker.Cache;
using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Resolve;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Hosted;

public sealed record FixedLookRequest(
    string OutputDirectory,
    int Race,
    int Sex,
    IReadOnlyList<int> ItemIds,
    IReadOnlyList<int>? AnimationIds = null,
    int ClassId = LookResolver.DefaultClassId,
    IReadOnlyList<EquipmentSlotOverride>? EquipmentOverrides = null,
    string? LookHash = null,
    IReadOnlyDictionary<int, int>? Customizations = null);

public sealed record FixedLookAsset(string Path, int FileDataId);

public sealed record FixedLookAnimation(int Id, string Name, string Path);

public sealed record FixedLookManifest(
    int SchemaVersion,
    string Build,
    int OutputVersion,
    CharacterLook Look,
    IReadOnlyList<ResolvedItem> Items,
    FixedLookAsset Body,
    string BodyMetadata,
    IReadOnlyList<FixedLookAnimation> Animations);

public sealed class FixedLookBaker
{
  public static readonly int[] DefaultAnimationIds = [0, 67]; // Stand and EmoteWave preserve the CLI contract.
  public static readonly int[] TroopAnimationIds = [0, 4, 67, 115, 116, 119]; // Stand, Walk, EmoteWave, KneelStart, KneelLoop, StealthWalk.
  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
  {
    WriteIndented = true,
  };
  readonly IGameFiles _files;
  readonly string _build;
  readonly IAnimationBakePolicy _animationPolicy;
  readonly LookResolver _looks;
  readonly ItemResolver _items;

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
    _files = files;
    _build = build;
    _animationPolicy = animationPolicy;
    _looks = new(tables);
    _items = new(tables);
  }

  public FixedLookManifest Bake(
      FixedLookRequest request,
      Action<string>? log = null,
      Action<double>? progress = null)
  {
    var steps = new BakeProgress(progress);
    if (request.ClassId <= 0)
      throw new ArgumentOutOfRangeException(
          nameof(request.ClassId),
          request.ClassId,
          "Class ID must be positive.");
    var duplicateOverrides = (request.EquipmentOverrides ?? [])
        .GroupBy(o => o.ItemId)
        .FirstOrDefault(group => group.Count() > 1);
    if (duplicateOverrides != null)
      throw new InvalidOperationException(
          $"Item {duplicateOverrides.Key} has conflicting duplicate equipment slot overrides.");
    var overrides = (request.EquipmentOverrides ?? []).ToDictionary(o => o.ItemId, o => o.EquipSlot);
    var resolvedItems = new List<ResolvedItem>();
    foreach (var id in request.ItemIds)
    {
      var item = _items.Resolve(
              id,
              request.Race,
              request.Sex,
              overrides.TryGetValue(id, out var overrideSlot) ? overrideSlot : null);
      if (item.Error != null)
      {
        log?.Invoke($"item {id} skipped: {item.Error}");
        continue;
      }
      resolvedItems.Add(item with { Build = _build, ModelSet = "hd" });
    }
    var duplicateSlot = resolvedItems
        .Where(item => item.EquipSlot != null)
        .GroupBy(item => item.EquipSlot!.Value)
        .FirstOrDefault(group => group.Count() > 1);
    if (duplicateSlot != null)
      throw new InvalidOperationException(
          $"Equipment slot {duplicateSlot.Key} is occupied by conflicting items: " +
          string.Join(", ", duplicateSlot.Select(item => $"{item.ItemId} ({item.Name})")) + ".");

    var body = _looks.Body(request.Race, request.Sex, ModelSet.Hd)
        ?? throw new InvalidOperationException(
            $"No HD body exists for race {request.Race}, sex {request.Sex}.");

    var bodyAsset = ConvertModel(
        body.bodyFileDataId,
        request.OutputDirectory,
        EmbeddedAnimationPolicy.StandAndGlobals,
        log);
    steps.Phase(BakeProgress.Body, 1, 1);
    var bodyMeta = ReadBodyMetadataPath(body.bodyFileDataId);
    var bodyMetaBytes = File.ReadAllBytes(Path.Combine(request.OutputDirectory, Native(bodyMeta)));
    var look = _looks.Resolve(
        request.Race,
        request.Sex,
        request.ClassId,
        ModelSet.Hd,
        _ => AssetConverter.GeosetIds(bodyMetaBytes),
        request.Customizations)
        ?? throw new InvalidOperationException(
            $"The default look could not be resolved for race {request.Race}, sex {request.Sex}.");

    var modelIds = resolvedItems
        .SelectMany(ModelIds)
        .Distinct()
        .Order()
        .ToList();
    var textureIds = new HashSet<int>(look.Layers.Select(l => l.FileDataId));
    foreach (var item in resolvedItems)
    {
      textureIds.UnionWith(ItemTextureIds(item));
    }
    var unavailableModels = new HashSet<int>();
    var modelsDone = 0;
    foreach (var modelId in modelIds)
    {
      steps.Phase(BakeProgress.Models, modelsDone++, modelIds.Count);
      try
      {
        _ = ConvertModel(
            modelId,
            request.OutputDirectory,
            EmbeddedAnimationPolicy.AllSequencesAndGlobals,
            log);
      }
      catch (FileNotFoundException error)
      {
        unavailableModels.Add(modelId);
        log?.Invoke($"model {modelId} unavailable, skipped: {error.Message}");
        continue;
      }
      var metadata = File.ReadAllBytes(
          Path.Combine(request.OutputDirectory, Native(MetadataPath(modelId))));
      textureIds.UnionWith(AssetConverter.TextureIds(metadata));
    }
    if (unavailableModels.Count > 0)
    {
      resolvedItems = resolvedItems.Select(item => WithoutModels(item, unavailableModels)).ToList();
    }
    steps.Phase(BakeProgress.Models, 1, 1);
    textureIds.UnionWith(AssetConverter.TextureIds(bodyMetaBytes));

    var texturesDone = 0;
    foreach (var textureId in textureIds.Order())
    {
      steps.Phase(BakeProgress.Textures, texturesDone++, textureIds.Count);
      ConvertTexture(request.OutputDirectory, textureId, log);
    }
    steps.Phase(BakeProgress.Textures, 1, 1);

    var animations = new List<FixedLookAnimation>();
    var sequenceIds = AssetConverter.SequenceIds(bodyMetaBytes).ToHashSet();
    var requestedAnimationIds = request.AnimationIds ?? DefaultAnimationIds;
    var selectedAnimationIds = _animationPolicy.Select(new(
        request.Race,
        request.Sex,
        requestedAnimationIds,
        sequenceIds)).ToList();
    var selectedAnimationIdSet = selectedAnimationIds.ToHashSet();
    foreach (var animationId in requestedAnimationIds.Distinct().Where(id => !selectedAnimationIdSet.Contains(id)))
      log?.Invoke(
          $"animation {AnimationNames.Name(animationId)} ({animationId}) unavailable for " +
          $"body {body.bodyFileDataId}, race {request.Race}, sex {request.Sex}; skipped");
    var animationsDone = 0;
    foreach (var animationId in selectedAnimationIds)
    {
      steps.Phase(BakeProgress.Animations, animationsDone++, selectedAnimationIds.Count);
      var path = ConvertAnimation(request.OutputDirectory, body.bodyFileDataId, animationId, log);
      animations.Add(new(animationId, AnimationNames.Name(animationId), path));
    }
    if (requestedAnimationIds.Contains(0) && animations.All(a => a.Id != 0))
      throw new InvalidOperationException(
          $"Body {body.bodyFileDataId} does not contain the Stand animation.");

    look = look with
    {
      Build = _build,
      Animations = animations.Select(a => new AnimationInfo(a.Id, a.Name)).ToList(),
    };
    var manifest = new FixedLookManifest(
        1,
        _build,
        AssetConverter.OutputVersion,
        look.ForPlayer(),
        resolvedItems,
        bodyAsset,
        bodyMeta,
        animations);

    WriteJson(request.OutputDirectory, ManifestPath(request.LookHash), manifest);
    WriteJson(
        request.OutputDirectory,
        "current.json",
        new { build = _build, fixedLook = "looks/fixed/look.json" });
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
    var body = _looks.Body(race, sex, ModelSet.Hd);
    if (body == null)
    {
      log?.Invoke($"race {race}, sex {sex} has no HD body; skipped");
      return new(race, sex, 0, Baked: false);
    }
    ConvertModel(body.Value.bodyFileDataId, outputDirectory, EmbeddedAnimationPolicy.StandAndGlobals, log);
    steps.Phase(BakeProgress.Body, 1, 1);
    var bodyMetaBytes = File.ReadAllBytes(
        Path.Combine(outputDirectory, Native(MetadataPath(body.Value.bodyFileDataId))));
    var look = _looks.Resolve(
        race,
        sex,
        LookResolver.DefaultClassId,
        ModelSet.Hd,
        _ => AssetConverter.GeosetIds(bodyMetaBytes),
        customizations: null);
    var textureIds = new HashSet<int>(AssetConverter.TextureIds(bodyMetaBytes));
    if (look != null)
    {
      foreach (var layer in look.Layers.Concat(
          look.Options.SelectMany(option => option.Choices).SelectMany(choice => choice.Layers)))
      {
        textureIds.Add(layer.FileDataId);
        if (layer.Candidates != null) textureIds.UnionWith(layer.Candidates);
      }
    }
    textureIds.Remove(0);
    steps.Phase(BakeProgress.Models, 1, 1);
    var done = 0;
    foreach (var textureId in textureIds.Order())
    {
      steps.Phase(BakeProgress.Textures, done++, textureIds.Count);
      ConvertTexture(outputDirectory, textureId, log);
    }
    steps.Phase(BakeProgress.Textures, 1, 1);
    var sequenceIds = AssetConverter.SequenceIds(bodyMetaBytes).ToHashSet();
    var selected = _animationPolicy.Select(new(race, sex, animationIds, sequenceIds)).ToList();
    done = 0;
    foreach (var animationId in selected)
    {
      steps.Phase(BakeProgress.Animations, done++, selected.Count);
      ConvertAnimation(outputDirectory, body.Value.bodyFileDataId, animationId, log);
    }
    steps.Phase(BakeProgress.Animations, 1, 1);
    return new(race, sex, textureIds.Count, Baked: true);
  }

  // Some classic textures are listed in root but absent from every CDN archive; the
  // client renders those surfaces with its fallback material instead of losing the look.
  void ConvertTexture(string outputDirectory, int textureId, Action<string>? log)
  {
    var path = TexturePath(textureId);
    if (Exists(outputDirectory, path))
    {
      log?.Invoke($"texture {textureId} exists, skipped");
      return;
    }
    byte[] source;
    try { source = _files.Open((uint)textureId); }
    catch (FileNotFoundException error)
    {
      log?.Invoke($"texture {textureId} unavailable, skipped: {error.Message}");
      return;
    }
    Write(outputDirectory, path, AssetConverter.ConvertTexture(source));
    log?.Invoke($"texture {textureId} -> {path}");
  }

  string ConvertAnimation(string outputDirectory, int bodyFileDataId, int animationId, Action<string>? log)
  {
    var path = AnimationPath(bodyFileDataId, animationId);
    if (Exists(outputDirectory, path))
    {
      log?.Invoke($"animation {AnimationNames.Name(animationId)} exists, skipped");
      return path;
    }
    Write(
        outputDirectory,
        path,
        AssetConverter.ConvertAnimation((uint)bodyFileDataId, animationId, _files.Open));
    log?.Invoke($"animation {AnimationNames.Name(animationId)} -> {path}");
    return path;
  }

  public void BakeSharedFile(
      string outputDirectory,
      string kind,
      int fileId,
      int? modelFileId = null,
      int? animationId = null,
      Action<string>? log = null)
  {
    switch (kind)
    {
      case "model":
        _ = ConvertModel(
            fileId,
            outputDirectory,
            EmbeddedAnimationPolicy.AllSequencesAndGlobals,
            log);
        return;
      case "texture":
        var texturePath = TexturePath(fileId);
        if (Exists(outputDirectory, texturePath))
        {
          log?.Invoke($"texture {fileId} exists, skipped");
          return;
        }
        Write(
            outputDirectory,
            texturePath,
            AssetConverter.ConvertTexture(_files.Open((uint)fileId)));
        log?.Invoke($"texture {fileId} -> {texturePath}");
        return;
      case "animation":
        if (modelFileId is not int modelId || animationId is not int animId)
          throw new ArgumentException("Animation converts need --model-file-id and --animation-id.");
        var animationPath = AnimationPath(modelId, animId);
        if (Exists(outputDirectory, animationPath))
        {
          log?.Invoke($"animation {animId} exists, skipped");
          return;
        }
        Write(
            outputDirectory,
            animationPath,
            AssetConverter.ConvertAnimation((uint)modelId, animId, _files.Open));
        log?.Invoke($"animation {AnimationNames.Name(animId)} -> {animationPath}");
        return;
      default:
        throw new ArgumentOutOfRangeException(nameof(kind), kind, "Kind must be model, texture, or animation.");
    }
  }

  FixedLookAsset ConvertModel(
      int fileDataId,
      string outputDirectory,
      EmbeddedAnimationPolicy animationPolicy,
      Action<string>? log)
  {
    var modelPath = ModelPath(fileDataId);
    var metadataPath = MetadataPath(fileDataId);
    var modelFull = Path.Combine(outputDirectory, Native(modelPath));
    var metadataFull = Path.Combine(outputDirectory, Native(metadataPath));
    if (File.Exists(modelFull) && File.Exists(metadataFull))
    {
      log?.Invoke($"model {fileDataId} exists, skipped");
      return new(modelPath, fileDataId);
    }
    var converted = AssetConverter.ConvertModel(
        (uint)fileDataId,
        _files.Open,
        animationPolicy);
    Write(outputDirectory, modelPath, converted.Glb);
    Write(outputDirectory, metadataPath, converted.MetaJson);
    log?.Invoke($"model {fileDataId} -> {modelPath}");
    return new(modelPath, fileDataId);
  }

  public static string ManifestPath(string? lookHash) =>
      string.IsNullOrEmpty(lookHash) ? "looks/fixed/look.json" : $"looks/{lookHash}/look.json";

  string ReadBodyMetadataPath(int fileDataId) => MetadataPath(fileDataId);

  // Some item models are listed in root but absent from every CDN archive. The item keeps its
  // textures and geosets; only the models the client could never load leave the manifest.
  public static ResolvedItem WithoutModels(ResolvedItem item, IReadOnlySet<int> unavailable) => item with
  {
    Models = item.Models
        .Select(slot => slot with { Models = slot.Models.Where(m => !unavailable.Contains(m.FileDataId)).ToList() })
        .ToList(),
    Attachments = item.Attachments.Where(a => !unavailable.Contains(a.ModelFileDataId)).ToList(),
    Effects = item.Effects.Where(e => !unavailable.Contains(e.ModelFileDataId)).ToList(),
  };

  static IEnumerable<int> ModelIds(ResolvedItem item) =>
      item.Models.SelectMany(m => m.Models).Select(m => m.FileDataId)
          .Concat(item.Attachments.Select(a => a.ModelFileDataId))
          .Concat(item.Effects.Select(e => e.ModelFileDataId));

  static IEnumerable<int> ItemTextureIds(ResolvedItem item) =>
      item.Models.SelectMany(m => m.Textures).Select(t => t.FileDataId)
          .Concat(item.BodyTextures.SelectMany(t => t.Textures).Select(t => t.FileDataId))
          .Concat(item.Attachments.Select(a => a.TextureFileDataId).OfType<int>())
          .Concat(item.BodyReplaceableTextures.Values);

  static string BuildRoot =>
      $"builds/{{0}}/v{AssetConverter.OutputVersion}";

  string ModelPath(int fileDataId) =>
      $"{string.Format(BuildRoot, _build)}/models/{fileDataId}.glb";

  string MetadataPath(int fileDataId) =>
      $"{string.Format(BuildRoot, _build)}/models/{fileDataId}.json";

  string TexturePath(int fileDataId) =>
      $"{string.Format(BuildRoot, _build)}/textures/{fileDataId}.png";

  string AnimationPath(int modelFileDataId, int animationId) =>
      $"{string.Format(BuildRoot, _build)}/anims/{modelFileDataId}/{animationId}.glb";

  static bool Exists(string root, string relativePath) =>
      File.Exists(Path.Combine(root, Native(relativePath)));

  static void Write(string root, string relativePath, ReadOnlySpan<byte> bytes) =>
      AtomicFile.WriteAllBytes(Path.Combine(root, Native(relativePath)), bytes);

  static void WriteJson<T>(string root, string relativePath, T value) =>
      AtomicFile.WriteAllText(
          Path.Combine(root, Native(relativePath)),
          JsonSerializer.Serialize(value, Json));

  static string Native(string path) =>
      path.Replace('/', Path.DirectorySeparatorChar);
}
