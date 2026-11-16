// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Storage;

namespace GuildHub.ModelBaker.Hosted;

/// <summary>
/// Converts game files into the asset store, skipping files a previous bake already wrote.
/// </summary>
public sealed class AssetConversionRunner(IGameFiles files, AssetStorePaths paths)
{
  public FixedLookAsset ConvertModel(
      AssetStoreWriter store,
      int fileDataId,
      EmbeddedAnimationPolicy animationPolicy,
      Action<string>? log)
  {
    var modelPath = paths.ModelPath(fileDataId);
    var metadataPath = paths.MetadataPath(fileDataId);
    if (store.Exists(modelPath) && store.Exists(metadataPath))
    {
      log?.Invoke($"model {fileDataId} exists, skipped");
      return new(modelPath, fileDataId);
    }
    var converted = AssetConverter.ConvertModel(
        (uint)fileDataId,
        files.Open,
        animationPolicy);
    store.Write(modelPath, converted.Glb);
    store.Write(metadataPath, converted.MetaJson);
    log?.Invoke($"model {fileDataId} -> {modelPath}");
    return new(modelPath, fileDataId);
  }

  public ModelConversionResult ConvertModels(
      AssetStoreWriter store,
      IReadOnlyList<int> modelIds,
      BakeProgress steps,
      Action<string>? log)
  {
    var unavailable = new HashSet<int>();
    var textureIds = new HashSet<int>();
    var done = 0;
    foreach (var modelId in modelIds)
    {
      steps.Phase(BakeProgress.Models, done++, modelIds.Count);
      try
      {
        _ = ConvertModel(store, modelId, EmbeddedAnimationPolicy.AllSequencesAndGlobals, log);
      }
      catch (FileNotFoundException error)
      {
        unavailable.Add(modelId);
        log?.Invoke($"model {modelId} unavailable, skipped: {error.Message}");
        continue;
      }
      textureIds.UnionWith(AssetConverter.TextureIds(store.Read(paths.MetadataPath(modelId))));
    }
    steps.Phase(BakeProgress.Models, 1, 1);
    return new(unavailable, textureIds);
  }

  // Some classic textures are listed in root but absent from every CDN archive; the
  // client renders those surfaces with its fallback material instead of losing the look.
  public void ConvertTexture(AssetStoreWriter store, int textureId, Action<string>? log)
  {
    var path = paths.TexturePath(textureId);
    if (store.Exists(path))
    {
      log?.Invoke($"texture {textureId} exists, skipped");
      return;
    }
    byte[] source;
    try { source = files.Open((uint)textureId); }
    catch (FileNotFoundException error)
    {
      log?.Invoke($"texture {textureId} unavailable, skipped: {error.Message}");
      return;
    }
    WriteTexture(store, textureId, path, source, log);
  }

  public void ConvertRequiredTexture(AssetStoreWriter store, int textureId, Action<string>? log)
  {
    var path = paths.TexturePath(textureId);
    if (store.Exists(path))
    {
      log?.Invoke($"texture {textureId} exists, skipped");
      return;
    }
    WriteTexture(store, textureId, path, files.Open((uint)textureId), log);
  }

  public void ConvertTextures(
      AssetStoreWriter store,
      IReadOnlySet<int> textureIds,
      BakeProgress steps,
      Action<string>? log)
  {
    var done = 0;
    foreach (var textureId in textureIds.Order())
    {
      steps.Phase(BakeProgress.Textures, done++, textureIds.Count);
      ConvertTexture(store, textureId, log);
    }
    steps.Phase(BakeProgress.Textures, 1, 1);
  }

  public string ConvertAnimation(
      AssetStoreWriter store,
      int bodyFileDataId,
      int animationId,
      Action<string>? log)
  {
    var path = paths.AnimationPath(bodyFileDataId, animationId);
    if (store.Exists(path))
    {
      log?.Invoke($"animation {AnimationNames.Name(animationId)} exists, skipped");
      return path;
    }
    WriteAnimation(store, bodyFileDataId, animationId, path, log);
    return path;
  }

  public void ConvertRequiredAnimation(
      AssetStoreWriter store,
      int modelFileDataId,
      int animationId,
      Action<string>? log)
  {
    var path = paths.AnimationPath(modelFileDataId, animationId);
    if (store.Exists(path))
    {
      log?.Invoke($"animation {animationId} exists, skipped");
      return;
    }
    WriteAnimation(store, modelFileDataId, animationId, path, log);
  }

  public List<FixedLookAnimation> ConvertAnimations(
      AssetStoreWriter store,
      int bodyFileDataId,
      IReadOnlyList<int> animationIds,
      BakeProgress steps,
      Action<string>? log)
  {
    var animations = new List<FixedLookAnimation>();
    var done = 0;
    foreach (var animationId in animationIds)
    {
      steps.Phase(BakeProgress.Animations, done++, animationIds.Count);
      var path = ConvertAnimation(store, bodyFileDataId, animationId, log);
      animations.Add(new(animationId, AnimationNames.Name(animationId), path));
    }
    return animations;
  }

  static void WriteTexture(
      AssetStoreWriter store,
      int textureId,
      string path,
      byte[] source,
      Action<string>? log)
  {
    store.Write(path, AssetConverter.ConvertTexture(source));
    log?.Invoke($"texture {textureId} -> {path}");
  }

  void WriteAnimation(
      AssetStoreWriter store,
      int modelFileDataId,
      int animationId,
      string path,
      Action<string>? log)
  {
    store.Write(path, AssetConverter.ConvertAnimation((uint)modelFileDataId, animationId, files.Open));
    log?.Invoke($"animation {AnimationNames.Name(animationId)} -> {path}");
  }
}
