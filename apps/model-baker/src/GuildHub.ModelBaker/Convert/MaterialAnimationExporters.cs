// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Numerics;
using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

interface IMaterialAnimationExporter
{
    string Kind { get; }
    int DefinitionCount(M2Model model);
    M2Track Track(M2Model model, int definition);
    M2TrackSample<float[]>? Sample(M2Track track, M2TrackSampleContext context);
}

sealed class MaterialAnimationExporter<T>(
    string kind,
    Func<M2Model, int> count,
    Func<M2Model, int, M2Track> track,
    int valueSize,
    Func<ReadOnlySpan<byte>, int, T> read,
    Func<T, float[]> values) : IMaterialAnimationExporter
{
    public string Kind => kind;
    public int DefinitionCount(M2Model model) => count(model);
    public M2Track Track(M2Model model, int definition) => track(model, definition);

    public M2TrackSample<float[]>? Sample(M2Track materialTrack, M2TrackSampleContext context)
    {
        var sample = M2TrackSampler.Sample(materialTrack, context, valueSize, read);
        return sample == null
            ? null
            : new M2TrackSample<float[]>(sample.Value.TimesSeconds, sample.Value.Values.Select(values).ToArray());
    }
}

static class MaterialAnimationExporters
{
    public static IReadOnlyList<IMaterialAnimationExporter> Registry { get; } =
    [
        new MaterialAnimationExporter<Vector3>(
            "color.rgb", model => model.Colors.Length, (model, i) => model.Colors[i].Rgb,
            12, M2Bin.V3, value => [value.X, value.Y, value.Z]),
        new MaterialAnimationExporter<float>(
            "color.alpha", model => model.Colors.Length, (model, i) => model.Colors[i].Alpha,
            2, ReadFixed16, value => [value]),
        new MaterialAnimationExporter<float>(
            "transparency.alpha", model => model.TextureWeights.Length, (model, i) => model.TextureWeights[i].Alpha,
            2, ReadFixed16, value => [value]),
        new MaterialAnimationExporter<Vector3>(
            "textureTransform.translation", model => model.TextureTransforms.Length, (model, i) => model.TextureTransforms[i].Translation,
            12, M2Bin.V3, value => [value.X, value.Y, value.Z]),
        new MaterialAnimationExporter<Quaternion>(
            "textureTransform.rotation", model => model.TextureTransforms.Length, (model, i) => model.TextureTransforms[i].Rotation,
            16, ReadQuaternion, value => [value.X, value.Y, value.Z, value.W]),
        new MaterialAnimationExporter<Vector3>(
            "textureTransform.scaling", model => model.TextureTransforms.Length, (model, i) => model.TextureTransforms[i].Scaling,
            12, M2Bin.V3, value => [value.X, value.Y, value.Z]),
    ];

    static float ReadFixed16(ReadOnlySpan<byte> data, int at) => M2Bin.I16(data, at) / 32767f;
    static Quaternion ReadQuaternion(ReadOnlySpan<byte> data, int at) =>
        new(M2Bin.F32(data, at), M2Bin.F32(data, at + 4), M2Bin.F32(data, at + 8), M2Bin.F32(data, at + 12));
}

static class MaterialAnimationMetadata
{
    public static (JsonArray tracks, JsonArray diagnostics) Export(
        M2Model model,
        IM2Skeleton skeleton,
        IReadOnlyList<int> embeddedSequences,
        Func<uint, byte[]> open)
    {
        var tracks = new JsonArray();
        var diagnostics = new JsonArray();
        var sequenceSources = new Dictionary<int, (byte[] data, int baseOfs, string source)?>();

        foreach (var exporter in MaterialAnimationExporters.Registry)
        {
            for (var definition = 0; definition < exporter.DefinitionCount(model); definition++)
            {
                var track = exporter.Track(model, definition);
                if (track.GlobalSeq >= 0)
                {
                    ExportGlobal(model, exporter, definition, track, tracks, diagnostics);
                    continue;
                }

                foreach (var sequenceIndex in embeddedSequences)
                {
                    if (sequenceIndex < 0 || sequenceIndex >= skeleton.Sequences.Length)
                    {
                        AddDiagnostic(diagnostics, exporter.Kind, definition, $"embedded sequence index {sequenceIndex} is out of range");
                        continue;
                    }
                    var sequence = skeleton.Sequences[sequenceIndex];
                    if (sequenceIndex >= track.Times.Length || track.Times[sequenceIndex].count == 0)
                        continue;
                    try
                    {
                        if (!sequenceSources.TryGetValue(sequenceIndex, out var source))
                        {
                            source = M2MaterialAnimSource.Resolve(model, skeleton, sequenceIndex, open);
                            sequenceSources.Add(sequenceIndex, source);
                        }
                        if (source == null)
                        {
                            AddDiagnostic(diagnostics, exporter.Kind, definition, $"sequence {sequence.Id}/{sequence.Variation} has no material track source");
                            continue;
                        }
                        var context = new M2TrackSampleContext(sequenceIndex, sequence.Duration, source.Value.data, source.Value.baseOfs, null);
                        AddTrack(tracks, exporter, definition, track, context, sequence.Id, sequence.Variation, null, diagnostics);
                    }
                    catch (Exception error) when (error is FileNotFoundException or InvalidDataException)
                    {
                        AddDiagnostic(diagnostics, exporter.Kind, definition, $"sequence {sequence.Id}/{sequence.Variation}: {error.Message}");
                    }
                }
            }
        }
        return (tracks, diagnostics);
    }

    static void ExportGlobal(
        M2Model model,
        IMaterialAnimationExporter exporter,
        int definition,
        M2Track track,
        JsonArray tracks,
        JsonArray diagnostics)
    {
        if (track.GlobalSeq >= model.GlobalSequences.Length)
        {
            AddDiagnostic(diagnostics, exporter.Kind, definition, $"global sequence {track.GlobalSeq} is out of range");
            return;
        }
        if (track.Times.Length == 0 || track.Times[0].count == 0) return;
        var (data, baseOfs) = model.InFileData;
        var context = new M2TrackSampleContext(0, model.GlobalSequences[track.GlobalSeq], data, baseOfs, track.GlobalSeq);
        AddTrack(tracks, exporter, definition, track, context, null, null, track.GlobalSeq, diagnostics);
    }

    static void AddTrack(
        JsonArray tracks,
        IMaterialAnimationExporter exporter,
        int definition,
        M2Track track,
        M2TrackSampleContext context,
        ushort? sequenceId,
        ushort? variation,
        int? globalSequence,
        JsonArray diagnostics)
    {
        var sample = exporter.Sample(track, context);
        if (sample == null)
        {
            AddDiagnostic(diagnostics, exporter.Kind, definition, "key counts or data bounds are invalid");
            return;
        }

        var keys = new JsonArray();
        for (var i = 0; i < sample.Value.TimesSeconds.Length; i++)
        {
            var key = new JsonArray(JsonValue.Create(sample.Value.TimesSeconds[i] * 1000f));
            foreach (var value in sample.Value.Values[i]) key.Add(value);
            keys.Add(key);
        }
        tracks.Add(new JsonObject
        {
            ["kind"] = exporter.Kind,
            ["targetIndex"] = definition,
            ["sequenceId"] = (int?)sequenceId,
            ["variation"] = (int?)variation,
            ["globalSequence"] = globalSequence,
            ["durationMs"] = context.DurationMs,
            ["interpolation"] = track.Interpolation.ToString().ToLowerInvariant(),
            ["keys"] = keys,
        });
    }

    static void AddDiagnostic(JsonArray diagnostics, string kind, int definition, string error) =>
        diagnostics.Add(new JsonObject { ["kind"] = kind, ["targetIndex"] = definition, ["error"] = error });
}
