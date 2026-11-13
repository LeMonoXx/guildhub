// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

public enum EmbeddedAnimationPolicy
{
    StandAndGlobals,
    AllSequencesAndGlobals,
}

// Public entry points over the ported converter. `open` reads a FileDataID from local storage and
// is also used for the skin, skeleton and .anim files a model references.
public static class AssetConverter
{
    static readonly ISkeletonLoader DefaultSkeletonLoader = new GameFileSkeletonLoader();

    // Bump when a change alters files the converter already wrote (a model, texture or animation
    // converts differently). Converted files are cached per version and served at URLs that carry
    // it, so a bump reconverts on next view and gets past the browser's year-long cache. New kinds
    // of output don't need a bump.
    // 2: model metadata gains particle emitters (shoulder and weapon glows).
    // 3: an auto-attack's animation file holds every swing, not only the first.
    // 4: SKID models use their external skeleton for bones and animation sequences.
    // 5: attached and effect models embed all of their own sequence animations.
    // 6: model metadata includes material animation tracks and resolved material lookup indices.
    public const int OutputVersion = 6;

    public sealed record ConvertedModel(byte[] Glb, byte[] MetaJson, IReadOnlyList<uint> HardcodedTextures);

    public static ConvertedModel ConvertModel(uint fdid, Func<uint, byte[]> open) =>
        ConvertModel(fdid, open, EmbeddedAnimationPolicy.StandAndGlobals, DefaultSkeletonLoader);

    public static ConvertedModel ConvertModel(
        uint fdid,
        Func<uint, byte[]> open,
        EmbeddedAnimationPolicy animationPolicy) =>
        ConvertModel(fdid, open, animationPolicy, DefaultSkeletonLoader);

    public static ConvertedModel ConvertModel(
        uint fdid,
        Func<uint, byte[]> open,
        ISkeletonLoader skeletonLoader)
        => ConvertModel(
            fdid,
            open,
            EmbeddedAnimationPolicy.StandAndGlobals,
            skeletonLoader);

    public static ConvertedModel ConvertModel(
        uint fdid,
        Func<uint, byte[]> open,
        EmbeddedAnimationPolicy animationPolicy,
        ISkeletonLoader skeletonLoader)
    {
        var m2 = M2Model.Parse(open(fdid));
        if (m2.SkinFileDataIds.Length == 0) throw new InvalidDataException($"Model {fdid} has no skin FileDataIDs in its SFID chunk");
        var skinFdid = m2.SkinFileDataIds[0];
        var skin = M2Skin.Parse(open(skinFdid));
        var skeleton = SkeletonLoader.Resolve(m2, open, skeletonLoader);
        var r = ModelConverter.Convert(
            fdid,
            m2,
            skeleton,
            skinFdid,
            skin,
            open,
            animationPolicy);
        return new ConvertedModel(r.Glb, System.Text.Encoding.UTF8.GetBytes(r.Meta.ToJsonString()), r.HardcodedTextures);
    }

    // Throws FileNotFoundException when the model has no such animation.
    public static byte[] ConvertAnimation(uint fdid, int animId, Func<uint, byte[]> open) =>
        ConvertAnimation(fdid, animId, open, DefaultSkeletonLoader);

    public static byte[] ConvertAnimation(
        uint fdid,
        int animId,
        Func<uint, byte[]> open,
        ISkeletonLoader skeletonLoader)
    {
        var model = M2Model.Parse(open(fdid));
        var skeleton = SkeletonLoader.Resolve(model, open, skeletonLoader);
        return ModelConverter.ConvertAnimation(model, skeleton, animId, open, out var meta)
            ?? throw new FileNotFoundException($"Model {fdid} has no animation {animId} ({AnimationNames.Name(animId)}): {meta["error"]}");
    }

    public static byte[] ConvertTexture(byte[] blp)
    {
        var img = Blp.Decode(blp);
        return Png.Encode(img.Width, img.Height, img.Rgba);
    }

    // Distinct geoset IDs of the mesh, from a model's metadata JSON.
    // Animation IDs the model has sequences for; empty for metadata written before they were recorded.
    public static IReadOnlyList<int> SequenceIds(byte[] metaJson) =>
        JsonNode.Parse(metaJson)!["sequenceIds"]?.AsArray().Select(x => (int)x!).ToList() ?? [];

    public static IReadOnlyList<int> GeosetIds(byte[] metaJson)
    {
        var meta = JsonNode.Parse(metaJson)!;
        return meta["geosets"]!.AsArray().Select(g => (int)g!["geosetId"]!).Distinct().Order().ToList();
    }

    // Distinct FileDataIDs of the model's hard-coded (type 0) textures, from its metadata JSON. The
    // hosted bake converts these alongside the model.
    public static IReadOnlyList<int> TextureIds(byte[] metaJson)
    {
        var meta = JsonNode.Parse(metaJson)!;
        return (meta["textures"]?.AsArray() ?? []).Select(t => t?["fileDataId"]?.GetValue<int>()).OfType<int>().Distinct().Order().ToList();
    }
}
