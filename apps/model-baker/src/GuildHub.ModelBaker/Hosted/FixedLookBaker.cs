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
    IReadOnlyList<EquipmentSlotOverride>? EquipmentOverrides = null);

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
  static readonly int[] DefaultAnimationIds = [0, 67]; // Stand and EmoteWave preserve the CLI contract.
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

  public FixedLookManifest Bake(FixedLookRequest request, Action<string>? log = null)
  {
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
    var resolvedItems = request.ItemIds.Select(id =>
    {
      var item = _items.Resolve(
              id,
              request.Race,
              request.Sex,
              overrides.TryGetValue(id, out var overrideSlot) ? overrideSlot : null);
      if (item.Error != null)
        throw new InvalidOperationException($"Item {id} could not be resolved: {item.Error}");
      return item with { Build = _build, ModelSet = "hd" };
    }).ToList();
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
    var bodyMeta = ReadBodyMetadataPath(body.bodyFileDataId);
    var bodyMetaBytes = File.ReadAllBytes(Path.Combine(request.OutputDirectory, Native(bodyMeta)));
    var look = _looks.Resolve(
        request.Race,
        request.Sex,
        request.ClassId,
        ModelSet.Hd,
        _ => AssetConverter.GeosetIds(bodyMetaBytes))
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
    foreach (var modelId in modelIds)
    {
      var converted = ConvertModel(
          modelId,
          request.OutputDirectory,
          EmbeddedAnimationPolicy.AllSequencesAndGlobals,
          log);
      var metadata = File.ReadAllBytes(
          Path.Combine(request.OutputDirectory, Native(MetadataPath(modelId))));
      textureIds.UnionWith(AssetConverter.TextureIds(metadata));
      _ = converted;
    }
    textureIds.UnionWith(AssetConverter.TextureIds(bodyMetaBytes));

    foreach (var textureId in textureIds.Order())
    {
      var path = TexturePath(textureId);
      Write(
          request.OutputDirectory,
          path,
          AssetConverter.ConvertTexture(_files.Open((uint)textureId)));
      log?.Invoke($"texture {textureId} -> {path}");
    }

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
    foreach (var animationId in selectedAnimationIds)
    {
      var path = AnimationPath(body.bodyFileDataId, animationId);
      Write(
          request.OutputDirectory,
          path,
          AssetConverter.ConvertAnimation(
              (uint)body.bodyFileDataId,
              animationId,
              _files.Open));
      animations.Add(new(animationId, AnimationNames.Name(animationId), path));
      log?.Invoke($"animation {AnimationNames.Name(animationId)} -> {path}");
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

    WriteJson(request.OutputDirectory, "looks/fixed/look.json", manifest);
    WriteJson(
        request.OutputDirectory,
        "current.json",
        new { build = _build, fixedLook = "looks/fixed/look.json" });
    return manifest;
  }

  FixedLookAsset ConvertModel(
      int fileDataId,
      string outputDirectory,
      EmbeddedAnimationPolicy animationPolicy,
      Action<string>? log)
  {
    var converted = AssetConverter.ConvertModel(
        (uint)fileDataId,
        _files.Open,
        animationPolicy);
    var modelPath = ModelPath(fileDataId);
    Write(outputDirectory, modelPath, converted.Glb);
    Write(outputDirectory, MetadataPath(fileDataId), converted.MetaJson);
    log?.Invoke($"model {fileDataId} -> {modelPath}");
    return new(modelPath, fileDataId);
  }

  string ReadBodyMetadataPath(int fileDataId) => MetadataPath(fileDataId);

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

  static void Write(string root, string relativePath, ReadOnlySpan<byte> bytes) =>
      AtomicFile.WriteAllBytes(Path.Combine(root, Native(relativePath)), bytes);

  static void WriteJson<T>(string root, string relativePath, T value) =>
      AtomicFile.WriteAllText(
          Path.Combine(root, Native(relativePath)),
          JsonSerializer.Serialize(value, Json));

  static string Native(string path) =>
      path.Replace('/', Path.DirectorySeparatorChar);
}
