// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Numerics;

namespace GuildHub.ModelBaker.Convert;

enum M2TrackUse
{
    Usable,
    NotForClip,
    Empty,
    Spline,
}

readonly record struct M2TrackSampleContext(
    int KeyIndex,
    uint DurationMs,
    byte[] Data,
    int BaseOffset,
    int? GlobalSequence)
{
    public M2TrackUse Classify(M2Track track)
    {
        var forClip = GlobalSequence is int global
            ? track.GlobalSeq == global
            : track.GlobalSeq < 0;
        if (!forClip) return M2TrackUse.NotForClip;
        if (KeyIndex >= track.Times.Length || track.Times[KeyIndex].count == 0)
            return M2TrackUse.Empty;
        return track.Interpolation.IsSpline() ? M2TrackUse.Spline : M2TrackUse.Usable;
    }
}

readonly record struct M2TrackSample<T>(float[] TimesSeconds, T[] Values);

static class M2TrackSampler
{
    public static M2TrackSample<T>? Sample<T>(
        M2Track track,
        M2TrackSampleContext context,
        int valueSize,
        Func<ReadOnlySpan<byte>, int, T> read)
    {
        var keys = track.Keys(
            context.KeyIndex,
            context.Data,
            context.BaseOffset,
            valueSize,
            read);
        if (keys == null) return null;

        var normalized = keys.Value.times
            .Select((time, index) => (
                time: NormalizeTime(time, context.DurationMs),
                value: keys.Value.values[index]))
            .OrderBy(key => key.time)
            .GroupBy(key => key.time)
            .Select(group => group.First())
            .ToArray();
        return new(
            normalized.Select(key => key.time / 1000f).ToArray(),
            normalized.Select(key => key.value).ToArray());
    }

    static uint NormalizeTime(uint time, uint duration) =>
        duration == 0
            ? time
            : time % duration == 0 && time > 0
                ? duration
                : time % duration;
}

// Channel exporters are deliberately track-kind-specific extension points. Material, UV and color
// tracks can be added to a registry without adding channel-kind branches to animation orchestration.
interface IAnimationChannelExporter
{
    string Path { get; }
    M2Track Track(M2Bone bone);
    (float[] times, float[][] values)? Read(
        M2Bone bone,
        M2TrackSampleContext context,
        IM2Skeleton skeleton);
}

static class AnimationChannelExporters
{
    public static IReadOnlyList<IAnimationChannelExporter> BoneChannels { get; } =
    [
        new TranslationExporter(),
        new RotationExporter(),
        new ScaleExporter(),
    ];

    sealed class TranslationExporter : IAnimationChannelExporter
    {
        public string Path => "translation";
        public M2Track Track(M2Bone bone) => bone.Translation;

        public (float[], float[][])? Read(
            M2Bone bone,
            M2TrackSampleContext context,
            IM2Skeleton skeleton)
        {
            var keys = M2TrackSampler.Sample(
                bone.Translation,
                context,
                12,
                M2Bin.V3);
            if (keys == null) return null;
            var pivot = ModelConverter.ToGltf(bone.Pivot);
            var parentPivot = bone.ParentBone >= 0
                ? ModelConverter.ToGltf(skeleton.Bones[bone.ParentBone].Pivot)
                : Vector3.Zero;
            return (keys.Value.TimesSeconds, keys.Value.Values.Select(value =>
            {
                var gltf = ModelConverter.ToGltf(value) + pivot - parentPivot;
                return new[] { gltf.X, gltf.Y, gltf.Z };
            }).ToArray());
        }
    }

    sealed class RotationExporter : IAnimationChannelExporter
    {
        public string Path => "rotation";
        public M2Track Track(M2Bone bone) => bone.Rotation;

        public (float[], float[][])? Read(
            M2Bone bone,
            M2TrackSampleContext context,
            IM2Skeleton skeleton)
        {
            var keys = M2TrackSampler.Sample(
                bone.Rotation,
                context,
                8,
                M2Bone.ReadCompQuat);
            if (keys == null) return null;
            return (keys.Value.TimesSeconds, keys.Value.Values.Select(value =>
            {
                var gltf = new Quaternion(value.X, value.Z, -value.Y, value.W);
                gltf = gltf.LengthSquared() > 1e-12f ? Quaternion.Normalize(gltf) : Quaternion.Identity;
                return new[] { gltf.X, gltf.Y, gltf.Z, gltf.W };
            }).ToArray());
        }
    }

    sealed class ScaleExporter : IAnimationChannelExporter
    {
        public string Path => "scale";
        public M2Track Track(M2Bone bone) => bone.Scale;

        public (float[], float[][])? Read(
            M2Bone bone,
            M2TrackSampleContext context,
            IM2Skeleton skeleton)
        {
            var keys = M2TrackSampler.Sample(
                bone.Scale,
                context,
                12,
                M2Bin.V3);
            return keys == null
                ? null
                : (keys.Value.TimesSeconds, keys.Value.Values
                    .Select(value => new[] { value.X, value.Z, value.Y })
                    .ToArray());
        }
    }
}
