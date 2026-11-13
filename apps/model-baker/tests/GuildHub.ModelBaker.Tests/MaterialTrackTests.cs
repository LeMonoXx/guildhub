// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Buffers.Binary;
using System.Numerics;
using GuildHub.ModelBaker.Convert;

namespace GuildHub.ModelBaker.Tests;

public class MaterialTrackTests
{
    [Fact]
    public void HandBuiltMd21UsesModernMaterialOffsetsStridesAndEncodings()
    {
        var model = M2Model.Parse(MaterialModel());

        Assert.Single(model.Colors);
        Assert.Single(model.Textures);
        Assert.Single(model.TextureWeights);
        Assert.Single(model.TextureTransforms);
        Assert.Equal((9u, 10u), (model.Textures[0].Type, model.Textures[0].Flags));
        Assert.Equal([3], model.TextureCombos);
        Assert.Equal([4], model.TextureCoordCombos);
        Assert.Equal([0], model.TextureWeightCombos);
        Assert.Equal([0], model.TextureTransformCombos);

        var exported = MaterialAnimationMetadata.Export(model, model, [0], _ => throw new FileNotFoundException());
        Assert.Empty(exported.diagnostics);
        Assert.Equal(
            ["color.rgb", "color.alpha", "transparency.alpha", "textureTransform.translation", "textureTransform.rotation", "textureTransform.scaling"],
            exported.tracks.Select(track => (string)track!["kind"]!));

        var alpha = exported.tracks.Single(track => (string)track!["kind"]! == "color.alpha")!;
        Assert.Equal(16384 / 32767f, (float)alpha["keys"]![0]![1]!, 5);
        Assert.Equal(-1f, (float)alpha["keys"]![1]![1]!);

        var rotation = exported.tracks.Single(track => (string)track!["kind"]! == "textureTransform.rotation")!;
        Assert.Equal([0f, 1.1f, 1.2f, 1.3f, 1.4f], rotation["keys"]![0]!.AsArray().Select(value => (float)value!).ToArray());
        Assert.Equal(7, (int)rotation["sequenceId"]!);
        Assert.Equal(3, (int)rotation["variation"]!);
        Assert.Equal("linear", (string)rotation["interpolation"]!);

        var global = exported.tracks.Single(track => (string)track!["kind"]! == "transparency.alpha")!;
        Assert.Equal(0, (int)global["globalSequence"]!);
        Assert.Null(global["sequenceId"]);
        Assert.Equal([0f, 1000f], global["keys"]!.AsArray().Select(key => (float)key![0]!).ToArray());
        Assert.Equal(1f, (float)global["keys"]![1]![1]!);
    }

    [Fact]
    public void HandBuiltSkinUsesEveryModernBatchOffsetAndResolvesLookups()
    {
        var bytes = new byte[96];
        U32(bytes, 0, 0x4E494B53);
        U32(bytes, 36, 1);
        U32(bytes, 40, 64);
        bytes[64] = 5;
        bytes[65] = unchecked((byte)-2);
        U16(bytes, 66, 6);
        U16(bytes, 68, 0);
        U16(bytes, 70, 7);
        U16(bytes, 72, 0);
        U16(bytes, 74, 1);
        U16(bytes, 76, 8);
        U16(bytes, 78, 1);
        U16(bytes, 80, 0);
        U16(bytes, 82, 0);
        U16(bytes, 84, 0);
        U16(bytes, 86, 0);

        var batch = Assert.Single(M2Skin.Parse(bytes).Batches);
        Assert.Equal((5, -2, 6, 0, 7, 0, 1, 8, 1, 0, 0, 0, 0),
            (batch.Flags, batch.Priority, batch.ShaderId, batch.SkinSectionIndex, batch.GeosetIndex,
                batch.ColorIndex, batch.MaterialIndex, batch.MaterialLayer, batch.TextureCount,
                batch.TextureComboIndex, batch.TextureCoordComboIndex, batch.TextureWeightComboIndex,
                batch.TextureTransformComboIndex));

        var model = M2Model.Parse(MaterialModel());
        model.TextureCombos = [0];
        var skin = new M2Skin
        {
            Submeshes = [new M2Skin.Submesh(0, 0, 0, 0, 0, 0)],
            Batches = [batch],
        };

        var converted = ModelConverter.Convert(1, model, model, 2, skin, _ => throw new FileNotFoundException(), EmbeddedAnimationPolicy.AllSequencesAndGlobals);
        var unit = converted.Meta["geosets"]![0]!["textureUnits"]![0]!;
        Assert.Equal(0, (int)unit["colorIndex"]!);
        Assert.Equal(7, (int)unit["geosetIndex"]!);
        Assert.Equal(4, (int)unit["textures"]![0]!["textureCoordIndex"]!);
        Assert.Equal(0, (int)unit["textures"]![0]!["textureWeightIndex"]!);
        Assert.Equal(0, (int)unit["textures"]![0]!["textureTransformIndex"]!);

        skin.Batches =
        [
            batch with
            {
                ColorIndex = ushort.MaxValue,
                TextureCoordComboIndex = ushort.MaxValue,
                TextureWeightComboIndex = ushort.MaxValue,
                TextureTransformComboIndex = ushort.MaxValue,
            },
        ];
        converted = ModelConverter.Convert(1, model, model, 2, skin, _ => throw new FileNotFoundException(), EmbeddedAnimationPolicy.AllSequencesAndGlobals);
        unit = converted.Meta["geosets"]![0]!["textureUnits"]![0]!;
        Assert.Null(unit["colorIndex"]);
        Assert.Null(unit["textures"]![0]!["textureCoordIndex"]);
        Assert.Null(unit["textures"]![0]!["textureWeightIndex"]);
        Assert.Null(unit["textures"]![0]!["textureTransformIndex"]);
    }

    [Fact]
    public void OptionalLookupsDistinguishAbsentFromOutOfRange()
    {
        var model = M2Model.Parse(MaterialModel());
        model.TextureCombos = [0];
        model.TextureCoordCombos = [];
        model.TextureWeightCombos = [];
        model.TextureTransformCombos = [];
        var batch = new M2Skin.Batch(0, 0, 0, 0, 0, ushort.MaxValue, 0, 0, 1, 0, 0, 0, 0);
        var skin = new M2Skin
        {
            Submeshes = [new M2Skin.Submesh(0, 0, 0, 0, 0, 0)],
            Batches = [batch],
        };

        var converted = ModelConverter.Convert(1, model, model, 2, skin, _ => throw new FileNotFoundException(), EmbeddedAnimationPolicy.AllSequencesAndGlobals);
        var layer = converted.Meta["geosets"]![0]!["textureUnits"]![0]!["textures"]![0]!;
        Assert.Null(layer["textureCoordIndex"]);
        Assert.Null(layer["textureWeightIndex"]);
        Assert.Null(layer["textureTransformIndex"]);
        Assert.Null(layer["errors"]);

        model.TextureCoordCombos = [0];
        model.TextureWeightCombos = [0];
        model.TextureTransformCombos = [0];
        skin.Batches = [batch with { TextureCoordComboIndex = 1, TextureWeightComboIndex = 1, TextureTransformComboIndex = 1 }];
        converted = ModelConverter.Convert(1, model, model, 2, skin, _ => throw new FileNotFoundException(), EmbeddedAnimationPolicy.AllSequencesAndGlobals);
        var errors = converted.Meta["geosets"]![0]!["textureUnits"]![0]!["textures"]![0]!["errors"]!.AsArray()
            .Select(error => (string)error!)
            .ToArray();
        Assert.Equal(
            ["texture coordinate combo 1 is out of range", "texture weight combo 1 is out of range", "texture transform combo 1 is out of range"],
            errors);
    }

    [Fact]
    public void Afm2FeedsMaterialTracksWhileAfsbStillFeedsBones()
    {
        var modelBytes = MaterialModel();
        var afm2 = modelBytes[8..(8 + 4096)];
        var mixed = Concat(Chunk(0x324D4641, afm2), Chunk(0x42534641, new byte[12]));
        var material = M2AnimFile.MaterialData(mixed, true);
        var bone = M2AnimFile.BoneData(mixed, true);

        Assert.Equal("AFM2", material.layout);
        Assert.Equal("AFSB", bone.layout);

        var model = M2Model.Parse(modelBytes);
        var skeleton = new SyntheticSkeleton
        {
            Bones = model.Bones,
            Sequences = [new M2Sequence(42, 9, 2000, 0, -1, 0)],
            AnimFileIds = [new M2AnimFileId(42, 9, 100)],
            ChunkedAnims = true,
        };
        var opens = 0;
        var exported = MaterialAnimationMetadata.Export(
            model,
            skeleton,
            [0],
            id =>
            {
                opens++;
                return id == 100 ? mixed : throw new FileNotFoundException();
            });
        var rgb = exported.tracks.Single(track => (string)track!["kind"]! == "color.rgb")!;
        Assert.Equal([0f, 2f, 3f, 4f], rgb["keys"]![0]!.AsArray().Select(value => (float)value!).ToArray());
        Assert.Equal([1000f, 1f, 2f, 3f], rgb["keys"]![1]!.AsArray().Select(value => (float)value!).ToArray());
        Assert.Equal(42, (int)rgb["sequenceId"]!);
        Assert.Equal(9, (int)rgb["variation"]!);
        Assert.Equal(2000u, (uint)rgb["durationMs"]!);
        Assert.Equal(1, opens);
    }

    [Fact]
    public void MaterialSequencesFollowEmbeddedAnimationPolicy()
    {
        var model = M2Model.Parse(MaterialModel());
        var skin = new M2Skin();

        var stand = ModelConverter.Convert(
            1, model, model, 2, skin, _ => throw new FileNotFoundException(),
            EmbeddedAnimationPolicy.StandAndGlobals);
        var all = ModelConverter.Convert(
            1, model, model, 2, skin, _ => throw new FileNotFoundException(),
            EmbeddedAnimationPolicy.AllSequencesAndGlobals);

        Assert.DoesNotContain(
            stand.Meta["materialAnimations"]!.AsArray(),
            track => track!["sequenceId"] != null);
        Assert.Contains(
            all.Meta["materialAnimations"]!.AsArray(),
            track => (int?)track!["sequenceId"] == 7 && (int?)track["variation"] == 3);
        Assert.Contains(
            stand.Meta["materialAnimations"]!.AsArray(),
            track => (int?)track!["globalSequence"] == 0);
    }

    [Fact]
    public void MalformedMaterialDefinitionHasBoundsDiagnostic()
    {
        var file = MaterialModel();
        U32(file, 8 + 0x48 + 4, 4090);
        var error = Assert.Throws<InvalidDataException>(() => M2Model.Parse(file));
        Assert.Contains("M2Color definitions", error.Message);
        Assert.Contains("outside file size", error.Message);
    }

    [Fact]
    public void MalformedMaterialLookupHasBoundsDiagnostic()
    {
        var file = MaterialModel();
        U32(file, 8 + 0x88 + 4, 4095);
        var error = Assert.Throws<InvalidDataException>(() => M2Model.Parse(file));
        Assert.Contains("texture coordinate combo lookup", error.Message);
        Assert.Contains("outside file size", error.Message);
    }

    static byte[] MaterialModel()
    {
        var body = new byte[4096];
        var end = 0x130;
        int Alloc(int size)
        {
            var at = end;
            end += (size + 3) & ~3;
            return at;
        }
        void Arr(int at, int count, int offset) { U32(body, at, (uint)count); U32(body, at + 4, (uint)offset); }
        void Track(int at, int valueSize, Action<int, int> writeValue, bool global = false)
        {
            U16(body, at, 1);
            I16(body, at + 2, global ? 0 : -1);
            var timePairs = Alloc(8);
            var valuePairs = Alloc(8);
            var times = Alloc(12);
            var values = Alloc(valueSize * 3);
            U32(body, times, 1000);
            U32(body, times + 4, 0);
            U32(body, times + 8, 2000);
            for (var i = 0; i < 3; i++) writeValue(values + i * valueSize, i);
            Arr(timePairs, 3, times);
            Arr(valuePairs, 3, values);
            Arr(at + 4, 1, timePairs);
            Arr(at + 12, 1, valuePairs);
        }

        U32(body, 0, 0x3032444D);
        U32(body, 4, 274);
        var globalDuration = Alloc(4);
        U32(body, globalDuration, 1000);
        Arr(0x14, 1, globalDuration);
        var sequence = Alloc(64);
        U16(body, sequence, 7);
        U16(body, sequence + 2, 3);
        U32(body, sequence + 4, 1000);
        U32(body, sequence + 12, 0x20);
        Arr(0x1C, 1, sequence);
        var bone = Alloc(88);
        I16(body, bone + 8, -1);
        Arr(0x2C, 1, bone);

        var color = Alloc(40);
        Track(color, 12, (at, i) => { F32(body, at, i + 1); F32(body, at + 4, i + 2); F32(body, at + 8, i + 3); });
        Track(color + 20, 2, (at, i) => I16(body, at, i == 0 ? -32767 : i == 1 ? 16384 : 32767));
        Arr(0x48, 1, color);
        var texture = Alloc(16);
        U32(body, texture, 9);
        U32(body, texture + 4, 10);
        Arr(0x50, 1, texture);
        var weight = Alloc(20);
        Track(weight, 2, (at, i) => I16(body, at, i == 1 ? 0 : 32767), global: true);
        Arr(0x58, 1, weight);
        var transform = Alloc(60);
        Track(transform, 12, (at, i) => F32(body, at, i + 10));
        Track(transform + 20, 16, (at, i) =>
        {
            F32(body, at, i + 0.1f); F32(body, at + 4, i + 0.2f);
            F32(body, at + 8, i + 0.3f); F32(body, at + 12, i + 0.4f);
        });
        Track(transform + 40, 12, (at, i) => F32(body, at, i + 20));
        Arr(0x60, 1, transform);
        var material = Alloc(4);
        U16(body, material, 11);
        U16(body, material + 2, 12);
        Arr(0x70, 1, material);
        foreach (var (header, value) in new[] { (0x80, 3), (0x88, 4), (0x90, 0), (0x98, 0) })
        {
            var lookup = Alloc(2);
            U16(body, lookup, value);
            Arr(header, 1, lookup);
        }

        return Chunk(0x3132444D, body);
    }

    static byte[] Chunk(uint id, byte[] body)
    {
        var result = new byte[8 + body.Length];
        U32(result, 0, id);
        U32(result, 4, (uint)body.Length);
        body.CopyTo(result, 8);
        return result;
    }

    static byte[] Concat(params byte[][] arrays) => arrays.SelectMany(value => value).ToArray();
    static void U16(byte[] data, int at, int value) => BinaryPrimitives.WriteUInt16LittleEndian(data.AsSpan(at), (ushort)value);
    static void I16(byte[] data, int at, int value) => BinaryPrimitives.WriteInt16LittleEndian(data.AsSpan(at), (short)value);
    static void U32(byte[] data, int at, uint value) => BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(at), value);
    static void F32(byte[] data, int at, float value) => BinaryPrimitives.WriteSingleLittleEndian(data.AsSpan(at), value);

    sealed class SyntheticSkeleton : IM2Skeleton
    {
        public M2Bone[] Bones { get; init; } = [];
        public M2Sequence[] Sequences { get; init; } = [];
        public M2AnimFileId[] AnimFileIds { get; init; } = [];
        public bool ChunkedAnims { get; init; }
        public (byte[] data, int baseOfs) InFileData => ([], 0);
    }
}
