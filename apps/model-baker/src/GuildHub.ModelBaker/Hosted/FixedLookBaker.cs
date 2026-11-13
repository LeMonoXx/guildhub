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
    IReadOnlyList<int> ItemIds);

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

public sealed class FixedLookBaker(IGameFiles files, ITables tables, string build)
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };
    static readonly int[] AnimationIds = [0, 67]; // Stand and EmoteWave.

    readonly LookResolver _looks = new(tables);
    readonly ItemResolver _items = new(tables);

    public FixedLookManifest Bake(FixedLookRequest request, Action<string>? log = null)
    {
        var body = _looks.Body(request.Race, request.Sex, ModelSet.Hd)
            ?? throw new InvalidOperationException(
                $"No HD body exists for race {request.Race}, sex {request.Sex}.");

        var bodyAsset = ConvertModel(body.bodyFileDataId, request.OutputDirectory, log);
        var bodyMeta = ReadBodyMetadataPath(body.bodyFileDataId);
        var bodyMetaBytes = File.ReadAllBytes(Path.Combine(request.OutputDirectory, Native(bodyMeta)));
        var look = _looks.Resolve(
            request.Race,
            request.Sex,
            LookResolver.DefaultClassId,
            ModelSet.Hd,
            _ => AssetConverter.GeosetIds(bodyMetaBytes))
            ?? throw new InvalidOperationException(
                $"The default look could not be resolved for race {request.Race}, sex {request.Sex}.");

        var resolvedItems = request.ItemIds.Select(id =>
        {
            var item = _items.Resolve(id, request.Race, request.Sex);
            if (item.Error != null)
                throw new InvalidOperationException($"Item {id} could not be resolved: {item.Error}");
            return item with { Build = build, ModelSet = "hd" };
        }).ToList();

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
            var converted = ConvertModel(modelId, request.OutputDirectory, log);
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
                AssetConverter.ConvertTexture(files.Open((uint)textureId)));
            log?.Invoke($"texture {textureId} -> {path}");
        }

        var animations = new List<FixedLookAnimation>();
        var sequenceIds = AssetConverter.SequenceIds(bodyMetaBytes).ToHashSet();
        foreach (var animationId in AnimationIds.Where(sequenceIds.Contains))
        {
            var path = AnimationPath(body.bodyFileDataId, animationId);
            Write(
                request.OutputDirectory,
                path,
                AssetConverter.ConvertAnimation(
                    (uint)body.bodyFileDataId,
                    animationId,
                    files.Open));
            animations.Add(new(animationId, AnimationNames.Name(animationId), path));
            log?.Invoke($"animation {AnimationNames.Name(animationId)} -> {path}");
        }
        if (animations.All(a => a.Id != 0))
            throw new InvalidOperationException(
                $"Body {body.bodyFileDataId} does not contain the Stand animation.");

        look = look with
        {
            Build = build,
            Animations = animations.Select(a => new AnimationInfo(a.Id, a.Name)).ToList(),
        };
        var manifest = new FixedLookManifest(
            1,
            build,
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
            new { build, fixedLook = "looks/fixed/look.json" });
        return manifest;
    }

    FixedLookAsset ConvertModel(
        int fileDataId,
        string outputDirectory,
        Action<string>? log)
    {
        var converted = AssetConverter.ConvertModel((uint)fileDataId, files.Open);
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
        $"{string.Format(BuildRoot, build)}/models/{fileDataId}.glb";

    string MetadataPath(int fileDataId) =>
        $"{string.Format(BuildRoot, build)}/models/{fileDataId}.json";

    string TexturePath(int fileDataId) =>
        $"{string.Format(BuildRoot, build)}/textures/{fileDataId}.png";

    string AnimationPath(int modelFileDataId, int animationId) =>
        $"{string.Format(BuildRoot, build)}/anims/{modelFileDataId}/{animationId}.glb";

    static void Write(string root, string relativePath, ReadOnlySpan<byte> bytes) =>
        AtomicFile.WriteAllBytes(Path.Combine(root, Native(relativePath)), bytes);

    static void WriteJson<T>(string root, string relativePath, T value) =>
        AtomicFile.WriteAllText(
            Path.Combine(root, Native(relativePath)),
            JsonSerializer.Serialize(value, Json));

    static string Native(string path) =>
        path.Replace('/', Path.DirectorySeparatorChar);
}
