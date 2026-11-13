// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Buffers.Binary;
using System.Text.Json.Nodes;
using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Tests;

public class ArchitectureGateTests
{
    [Fact]
    public void RequestedBakePolicySelectsAvailableRogueProofClips()
    {
        var policy = new RequestedAnimationBakePolicy();
        int[] rogueProof = [0, 4, 5, 26, 32, 54, 114, 115, 116, 119, 120, 123, 128, 129, 224];
        IReadOnlySet<int> available = new HashSet<int>(rogueProof.Except([54]));

        Assert.Equal(
            rogueProof.Except([54]),
            policy.Select(new(1, 0, rogueProof, available)));
        Assert.DoesNotContain(
            120,
            policy.Select(new(5, 1, rogueProof, new HashSet<int>(rogueProof))));
    }

    [Fact]
    public void ChannelRegistryHasOneExporterPerBoneTrsPath()
    {
        Assert.Equal(
            ["translation", "rotation", "scale"],
            AnimationChannelExporters.BoneChannels.Select(exporter => exporter.Path));
    }

    [Fact]
    public void MaterialTrackRegistryOwnsEveryMetadataKind()
    {
        Assert.Equal(
            ["color.rgb", "color.alpha", "transparency.alpha", "textureTransform.translation", "textureTransform.rotation", "textureTransform.scaling"],
            MaterialAnimationExporters.Registry.Select(exporter => exporter.Kind));
    }

    [Fact]
    public void SharedTrackSamplerNormalizesSortsAndDeduplicatesTimes()
    {
        var data = new byte[24];
        U32File(data, 0, 1000);
        U32File(data, 4, 0);
        U32File(data, 8, 2000);
        U32File(data, 12, 10);
        U32File(data, 16, 20);
        U32File(data, 20, 30);
        var track = new M2Track
        {
            Interpolation = M2Interpolation.Linear,
            GlobalSeq = -1,
            Times = [(3, 0)],
            Values = [(3, 12)],
        };

        var sample = M2TrackSampler.Sample(
            track,
            new M2TrackSampleContext(0, 1000, data, 0, null),
            4,
            M2Bin.U32);

        Assert.NotNull(sample);
        Assert.Equal([0f, 1f], sample.Value.TimesSeconds);
        Assert.Equal([20u, 10u], sample.Value.Values);
    }

    [Fact]
    public void SyntheticM2ExportsTranslatedBoneAndEveryAutoAttackVariation()
    {
        var model = M2Model.Parse(AnimationModel(17, [1, 0]));
        var glb = ModelConverter.ConvertAnimation(
            model,
            model,
            17,
            _ => throw new FileNotFoundException(),
            out var meta);

        var json = GlbJson(glb!);
        var clips = json["animations"]!.AsArray();
        Assert.Equal(["anim_17_0", "anim_17_1"], clips.Select(clip => (string)clip!["name"]!));
        Assert.All(clips, clip =>
        {
            var channel = Assert.Single(clip!["channels"]!.AsArray());
            Assert.Equal("translation", (string)channel!["target"]!["path"]!);
            Assert.Equal(0, (int)channel["target"]!["node"]!);
            Assert.Equal(17, (int)clip["extras"]!["animId"]!);
        });
        Assert.Equal(1, (int)meta["channels"]!["translation"]!);
        Assert.Equal(0, (int)meta["channels"]!["rotation"]!);
    }

    [Fact]
    public void GenericModelPolicyEmbedsItemEffectSequencesAndMetadata()
    {
        var model = M2Model.Parse(AnimationModel(17, [1, 0]));

        var converted = ModelConverter.Convert(
            700,
            model,
            model,
            701,
            new M2Skin(),
            _ => throw new FileNotFoundException(),
            EmbeddedAnimationPolicy.AllSequencesAndGlobals);

        Assert.Equal(
            ["anim_17_0", "anim_17_1"],
            GlbJson(converted.Glb)["animations"]!.AsArray()
                .Select(animation => (string)animation!["name"]!));
        Assert.Equal(
            "AllSequencesAndGlobals",
            (string)converted.Meta["embeddedAnimationPolicy"]!);
        Assert.Equal(
            ["anim_17_0", "anim_17_1"],
            converted.Meta["animations"]!.AsArray()
                .Select(animation => (string)animation!["name"]!));
    }

    [Fact]
    public void GenericModelPolicyEmbedsGlobalClipsAndMetadata()
    {
        var model = M2Model.Parse(AnimationModel(0, [0], global: true));

        var converted = ModelConverter.Convert(
            800,
            model,
            model,
            801,
            new M2Skin(),
            _ => throw new FileNotFoundException(),
            EmbeddedAnimationPolicy.AllSequencesAndGlobals);

        Assert.Equal(
            "Global_0",
            (string)Assert.Single(GlbJson(converted.Glb)["animations"]!.AsArray())!["name"]!);
        var metadata = Assert.Single(
            converted.Meta["animations"]!.AsArray(),
            animation => animation!["globalSequence"] != null);
        Assert.Equal(0, (int)metadata!["globalSequence"]!);
        Assert.Equal("Global_0", (string)metadata["name"]!);
    }

    [Fact]
    public void SharedBinaryBuilderKeepsAlignmentTargetsAndGlbShape()
    {
        var builder = new GltfBinaryBuilder();
        var view = builder.AddView([1, 2, 3], 34962);
        var accessor = builder.AddAccessor(view, 5121, 3, "SCALAR");
        builder.Pad();
        var json = new JsonObject
        {
            ["asset"] = new JsonObject { ["version"] = "2.0" },
            ["accessors"] = builder.Accessors,
            ["bufferViews"] = builder.BufferViews,
            ["buffers"] = new JsonArray(new JsonObject { ["byteLength"] = builder.Length }),
        };

        var parsed = GlbJson(builder.Build(json));
        Assert.Equal(4, (int)parsed["buffers"]![0]!["byteLength"]!);
        Assert.Equal(34962, (int)parsed["bufferViews"]![view]!["target"]!);
        Assert.Equal(view, (int)parsed["accessors"]![accessor]!["bufferView"]!);
    }

    [Fact]
    public void SkidModelUsesInjectedExternalSkeletonSequences()
    {
        var model = M2Model.Parse(WithSkid(AnimationModel(0, [0]), 900));
        var loader = new StubSkeletonLoader(Skeleton(67));

        var resolved = SkeletonLoader.Resolve(
            model,
            _ => throw new FileNotFoundException(),
            loader);

        Assert.Equal(900u, loader.Requested);
        Assert.Equal(67, resolved.Sequences[0].Id);
    }

    [Fact]
    public void IncompatibleExternalBindPoseFailsWithDiagnostic()
    {
        var model = M2Model.Parse(WithSkid(AnimationModel(0, [0]), 901));
        var incompatible = Skeleton(0, parent: 0);

        var error = Assert.Throws<InvalidDataException>(() =>
            SkeletonLoader.Resolve(
                model,
                _ => throw new FileNotFoundException(),
                new StubSkeletonLoader(incompatible)));

        Assert.Contains("skin bind pose", error.Message);
        Assert.Contains("conversion was stopped", error.Message);
    }

    static byte[] AnimationModel(
        ushort id,
        ushort[] variations,
        bool global = false)
    {
        const int header = 0x130;
        var body = new byte[4096];
        var end = header;
        int Alloc(int size)
        {
            var at = end;
            end += (size + 3) & ~3;
            return at;
        }
        void U16(int at, int value) => BinaryPrimitives.WriteUInt16LittleEndian(body.AsSpan(at), (ushort)value);
        void I16(int at, int value) => BinaryPrimitives.WriteInt16LittleEndian(body.AsSpan(at), (short)value);
        void U32(int at, uint value) => BinaryPrimitives.WriteUInt32LittleEndian(body.AsSpan(at), value);
        void F32(int at, float value) => BinaryPrimitives.WriteSingleLittleEndian(body.AsSpan(at), value);
        void Arr(int at, int count, int offset) { U32(at, (uint)count); U32(at + 4, (uint)offset); }

        U32(0, 0x3032444D);
        U32(4, 274);
        if (global)
        {
            var globalDuration = Alloc(4);
            U32(globalDuration, 1000);
            Arr(0x14, 1, globalDuration);
        }
        var sequences = Alloc(variations.Length * 64);
        for (var i = 0; i < variations.Length; i++)
        {
            U16(sequences + i * 64, id);
            U16(sequences + i * 64 + 2, variations[i]);
            U32(sequences + i * 64 + 4, 1000);
            U32(sequences + i * 64 + 12, 0x20);
        }
        Arr(0x1C, variations.Length, sequences);

        var bone = Alloc(88);
        I16(bone + 8, -1);
        var track = bone + 16;
        U16(track, 1);
        I16(track + 2, global ? 0 : -1);
        var timePairs = Alloc(variations.Length * 8);
        var valuePairs = Alloc(variations.Length * 8);
        for (var i = 0; i < variations.Length; i++)
        {
            var times = Alloc(8);
            U32(times, 0);
            U32(times + 4, 1000);
            var values = Alloc(24);
            F32(values, i + 1);
            F32(values + 12, i + 2);
            Arr(timePairs + i * 8, 2, times);
            Arr(valuePairs + i * 8, 2, values);
        }
        Arr(track + 4, variations.Length, timePairs);
        Arr(track + 12, variations.Length, valuePairs);
        Arr(0x2C, 1, bone);

        var file = new byte[8 + body.Length];
        U32File(file, 0, 0x3132444D);
        U32File(file, 4, (uint)body.Length);
        body.CopyTo(file, 8);
        return file;
    }

    static byte[] WithSkid(byte[] model, uint fileDataId)
    {
        var chunk = new byte[12];
        U32File(chunk, 0, 0x44494B53);
        U32File(chunk, 4, 4);
        U32File(chunk, 8, fileDataId);
        return [.. model, .. chunk];
    }

    static byte[] Skeleton(ushort animationId, short parent = -1)
    {
        var skb = new byte[96];
        U32File(skb, 0, 1);
        U32File(skb, 4, 8);
        BinaryPrimitives.WriteInt16LittleEndian(skb.AsSpan(8 + 8), parent);

        var sks = new byte[80];
        U32File(sks, 8, 1);
        U32File(sks, 12, 16);
        BinaryPrimitives.WriteUInt16LittleEndian(sks.AsSpan(16), animationId);
        U32File(sks, 20, 1000);
        U32File(sks, 28, 0x20);
        return [.. Chunk(0x31424B53, skb), .. Chunk(0x31534B53, sks)];
    }

    static byte[] Chunk(uint id, byte[] body)
    {
        var chunk = new byte[8 + body.Length];
        U32File(chunk, 0, id);
        U32File(chunk, 4, (uint)body.Length);
        body.CopyTo(chunk, 8);
        return chunk;
    }

    static void U32File(byte[] bytes, int at, uint value) =>
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(at), value);

    static JsonObject GlbJson(byte[] glb)
    {
        Assert.Equal(0x46546C67u, BinaryPrimitives.ReadUInt32LittleEndian(glb));
        var jsonLength = BinaryPrimitives.ReadInt32LittleEndian(glb.AsSpan(12));
        return JsonNode.Parse(glb.AsSpan(20, jsonLength))!.AsObject();
    }

    sealed class StubSkeletonLoader(byte[] bytes) : ISkeletonLoader
    {
        public uint Requested { get; private set; }

        public byte[] Load(uint skeletonFileDataId, Func<uint, byte[]> open)
        {
            Requested = skeletonFileDataId;
            return bytes;
        }
    }
}
