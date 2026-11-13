// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

// Portions ported from wow.export (https://github.com/Kruithne/wow.export), MIT License, Copyright (c) Kruithne and Marlamin.
// Source: src/js/3D/loaders/M2Loader.js and src/js/3D/Skin.js. Layouts checked against
// https://wowdev.wiki/M2 and https://wowdev.wiki/M2/.skin.
//
// Reads vertices (with bone weights and indices), textures, materials, texture combos, bones with their animation
// track headers, sequences, attachments, where the particle emitters are (M2Particles reads them), and the
// chunked-file FileDataID lists (SFID, TXID, SKID, AFID).

using System.Buffers.Binary;
using System.Numerics;
using System.Text;

namespace GuildHub.ModelBaker.Convert;

sealed class M2Model : IM2Skeleton
{
    public record Vertex(Vector3 Position, Vector3 Normal, Vector2 Uv0, uint BoneWeights, uint BoneIndices);
    public record Texture(uint Type, uint Flags, uint FileDataId);
    public record Color(M2Track Rgb, M2Track Alpha);
    public record TextureWeight(M2Track Alpha);
    public record TextureTransform(M2Track Translation, M2Track Rotation, M2Track Scaling);
    public record Attachment(uint Id, ushort Bone, Vector3 Position);
    // M2Material: render flags (0x1 unlit, 0x2 unfogged, 0x4 two-sided, 0x8 no depth test, 0x10 no depth write)
    // and blending mode (0 opaque, 1 alpha key, 2 alpha, 3 no-alpha add, 4 add, 5 mod, 6 mod2x, 7 blend add).
    public record Material(ushort Flags, ushort BlendMode);

    public uint Version;
    public string Name = "";
    public uint Flags;
    public Vertex[] Vertices = [];
    public uint ViewCount;
    public Texture[] Textures = [];
    public Color[] Colors = [];
    public TextureWeight[] TextureWeights = [];
    public TextureTransform[] TextureTransforms = [];
    public ushort[] TextureCombos = [];
    public ushort[] TextureCoordCombos = [];
    public ushort[] TextureWeightCombos = [];
    public ushort[] TextureTransformCombos = [];
    public Material[] Materials = [];
    public M2Bone[] Bones { get; private set; } = [];
    public M2Sequence[] Sequences { get; private set; } = [];
    public M2AnimFileId[] AnimFileIds { get; private set; } = [];
    // wow.export M2Loader: .anim files are chunked when flag 0x200000 is set or the model has a .skel.
    public bool ChunkedAnims => (Flags & 0x200000) != 0 || SkeletonFileDataId > 0;
    public (byte[] data, int baseOfs) InFileData => (_data, _md20);
    public List<string> Chunks = [];
    byte[] _data = [];
    int _md20;
    public Attachment[] Attachments = [];
    public short[] AttachmentLookup = [];
    public uint[] SkinFileDataIds = [];
    public uint SkeletonFileDataId;
    public uint[] GlobalSequences = [];  // global loop durations in ms (MD20 header offset 20)

    const uint MD21 = 0x3132444D, MD20 = 0x3032444D, SFID = 0x44494653, TXID = 0x44495854, SKID = 0x44494B53, AFID = 0x44494641;

    public static M2Model Parse(byte[] data)
    {
        var m = new M2Model { _data = data };
        var txid = Array.Empty<uint>();
        uint[]? sfid = null;
        var pos = 0;
        var sawMd21 = false;
        while (pos + 8 <= data.Length)
        {
            var id = U32(data, pos);
            var size = (int)U32(data, pos + 4);
            var body = pos + 8;
            if (body + size > data.Length)
                throw new InvalidDataException($"Chunk {FourCC(id)} at offset {pos} runs past end of file ({body + size} > {data.Length})");
            m.Chunks.Add($"{FourCC(id)}({size})");
            switch (id)
            {
                case MD21: m.ParseMd20(data.AsSpan(body, size)); m._md20 = body; sawMd21 = true; break;
                case SFID: sfid = ReadU32s(data, body, size / 4); break;
                case TXID: txid = ReadU32s(data, body, size / 4); break;
                case SKID: m.SkeletonFileDataId = U32(data, body); break;
                case AFID: m.AnimFileIds = M2Bin.ReadAfid(data, body, size); break;
            }
            pos = body + size;
        }
        if (!sawMd21) throw new InvalidDataException("No MD21 chunk; legacy (non-chunked) M2 is not supported");

        // SFID holds viewCount skin IDs followed by LOD skin IDs. Only the first viewCount are real skins.
        m.SkinFileDataIds = sfid == null ? [] : sfid.Take((int)m.ViewCount).ToArray();
        // TXID gives one FileDataID per texture entry, in order. Only hardcoded (type 0) textures use it.
        m.Textures = m.Textures.Select((t, i) => t with { FileDataId = i < txid.Length ? txid[i] : 0 }).ToArray();
        return m;
    }

    void ParseMd20(ReadOnlySpan<byte> d)
    {
        if (U32(d, 0) != MD20) throw new InvalidDataException("MD21 chunk does not start with MD20 magic");
        Version = U32(d, 4);
        var (nameCount, nameOfs) = Arr(d, 8);
        if (nameCount > 0) Name = Encoding.ASCII.GetString(d.Slice((int)nameOfs, (int)nameCount)).TrimEnd('\0');
        Flags = U32(d, 16);

        var (gsCount, gsOfs) = Arr(d, 20);
        GlobalSequences = new uint[gsCount];
        for (var i = 0; i < gsCount; i++) GlobalSequences[i] = U32(d, (int)gsOfs + i * 4);
        Sequences = M2Sequence.ReadArray(d, 28, 0);
        Bones = M2Bone.ReadArray(d, 44, 0);

        // Vertices: 48 bytes each (pos, bone weights[4], bone indices[4], normal, uv0, uv1).
        var (vertCount, vertOfs) = Arr(d, 60);
        Vertices = new Vertex[vertCount];
        for (var i = 0; i < vertCount; i++)
        {
            var o = (int)vertOfs + i * 48;
            Vertices[i] = new Vertex(V3(d, o), V3(d, o + 20), new Vector2(F32(d, o + 32), F32(d, o + 36)), U32(d, o + 12), U32(d, o + 16));
        }

        ViewCount = U32(d, 68);

        // Material animation definitions. Track headers and their sequence lookup arrays are in MD20;
        // key data may instead live in an AFM2 payload for an external .anim.
        var (colorCount, colorOfs) = CheckedArray(d, 0x48, 40, "M2Color definitions");
        Colors = new Color[colorCount];
        for (var i = 0; i < colorCount; i++)
        {
            var o = (int)colorOfs + i * 40;
            Colors[i] = new Color(
                M2Track.Read(d, o, 0, $"M2Color[{i}].rgb"),
                M2Track.Read(d, o + 20, 0, $"M2Color[{i}].alpha"));
        }

        // Textures: 16 bytes each (type, flags, filename M2Array).
        var (texCount, texOfs) = CheckedArray(d, 0x50, 16, "M2Texture definitions");
        Textures = new Texture[texCount];
        for (var i = 0; i < texCount; i++)
        {
            var o = (int)texOfs + i * 16;
            Textures[i] = new Texture(U32(d, o), U32(d, o + 4), 0);
        }

        var (weightCount, weightOfs) = CheckedArray(d, 0x58, 20, "M2TextureWeight definitions");
        TextureWeights = new TextureWeight[weightCount];
        for (var i = 0; i < weightCount; i++)
            TextureWeights[i] = new TextureWeight(M2Track.Read(d, (int)weightOfs + i * 20, 0, $"M2TextureWeight[{i}].alpha"));

        var (transformCount, transformOfs) = CheckedArray(d, 0x60, 60, "M2TextureTransform definitions");
        TextureTransforms = new TextureTransform[transformCount];
        for (var i = 0; i < transformCount; i++)
        {
            var o = (int)transformOfs + i * 60;
            TextureTransforms[i] = new TextureTransform(
                M2Track.Read(d, o, 0, $"M2TextureTransform[{i}].translation"),
                M2Track.Read(d, o + 20, 0, $"M2TextureTransform[{i}].rotation"),
                M2Track.Read(d, o + 40, 0, $"M2TextureTransform[{i}].scaling"));
        }

        // Materials: 4 bytes each (flags u16, blending mode u16). https://wowdev.wiki/M2#Render_flags_and_blending_modes
        var (matCount, matOfs) = CheckedArray(d, 0x70, 4, "M2Material definitions");
        Materials = new Material[matCount];
        for (var i = 0; i < matCount; i++)
        {
            var o = (int)matOfs + i * 4;
            Materials[i] = new Material(BinaryPrimitives.ReadUInt16LittleEndian(d[o..]), BinaryPrimitives.ReadUInt16LittleEndian(d[(o + 2)..]));
        }

        // Texture combos (a.k.a. texture lookup): maps a batch's textureComboIndex to a texture index.
        TextureCombos = ReadLookup(d, 0x80, "texture combo lookup");
        TextureCoordCombos = ReadLookup(d, 0x88, "texture coordinate combo lookup");
        TextureWeightCombos = ReadLookup(d, 0x90, "texture weight combo lookup");
        TextureTransformCombos = ReadLookup(d, 0x98, "texture transform combo lookup");

        // Attachments: 40 bytes each (id, bone, unknown, position, animate_attached track).
        var (attCount, attOfs) = Arr(d, 240);
        Attachments = new Attachment[attCount];
        for (var i = 0; i < attCount; i++)
        {
            var o = (int)attOfs + i * 40;
            Attachments[i] = new Attachment(U32(d, o), BinaryPrimitives.ReadUInt16LittleEndian(d[(o + 4)..]), V3(d, o + 8));
        }
        var (lookCount, lookOfs) = Arr(d, 248);
        AttachmentLookup = new short[lookCount];
        for (var i = 0; i < lookCount; i++) AttachmentLookup[i] = BinaryPrimitives.ReadInt16LittleEndian(d[((int)lookOfs + i * 2)..]);

        // Particle emitters (header offset 0x128). A record is M2ParticleOld (476 bytes), plus the
        // multi-texture scroll fields (16 bytes) from version 272 or with flag 0x200 (wowdev.wiki/M2,
        // flag_new_particle_record). M2Particles reads the records.
        if (d.Length >= 0x130)
        {
            (ParticleCount, ParticleOfs) = ((int)U32(d, 0x128), (int)U32(d, 0x12C));
            ParticleStride = Version > 271 || (Flags & 0x200) != 0 ? 492 : 476;
        }
    }

    public int ParticleCount, ParticleOfs, ParticleStride;

    static (uint count, uint ofs) Arr(ReadOnlySpan<byte> d, int at) => (U32(d, at), U32(d, at + 4));
    static (uint count, uint ofs) CheckedArray(ReadOnlySpan<byte> d, int at, int stride, string diagnostic)
    {
        M2Bin.Require(d, at, 8, $"{diagnostic} header");
        var array = Arr(d, at);
        M2Bin.RequireArray(d, (int)array.ofs, array.count, stride, diagnostic);
        return array;
    }

    static ushort[] ReadLookup(ReadOnlySpan<byte> d, int at, string diagnostic)
    {
        var (count, ofs) = CheckedArray(d, at, 2, diagnostic);
        var values = new ushort[count];
        for (var i = 0; i < count; i++)
            values[i] = BinaryPrimitives.ReadUInt16LittleEndian(d[((int)ofs + i * 2)..]);
        return values;
    }
    internal static uint U32(ReadOnlySpan<byte> d, int at) => BinaryPrimitives.ReadUInt32LittleEndian(d[at..]);
    static int I32(ReadOnlySpan<byte> d, int at) => BinaryPrimitives.ReadInt32LittleEndian(d[at..]);
    static float F32(ReadOnlySpan<byte> d, int at) => BinaryPrimitives.ReadSingleLittleEndian(d[at..]);
    static Vector3 V3(ReadOnlySpan<byte> d, int at) => new(F32(d, at), F32(d, at + 4), F32(d, at + 8));
    static uint[] ReadU32s(byte[] d, int at, int n) => Enumerable.Range(0, n).Select(i => U32(d, at + i * 4)).ToArray();
    static string FourCC(uint id) => Encoding.ASCII.GetString(BitConverter.GetBytes(id));
}

sealed class M2Skin
{
    public record Submesh(ushort SkinSectionId, ushort Level, ushort VertexStart, ushort VertexCount, int TriangleStart, int TriangleCount);
    public record Batch(
        byte Flags,
        sbyte Priority,
        ushort ShaderId,
        ushort SkinSectionIndex,
        ushort GeosetIndex,
        ushort ColorIndex,
        ushort MaterialIndex,
        ushort MaterialLayer,
        ushort TextureCount,
        ushort TextureComboIndex,
        ushort TextureCoordComboIndex,
        ushort TextureWeightComboIndex,
        ushort TextureTransformComboIndex);

    public ushort[] Indices = [];   // skin vertex list -> global M2 vertex index
    public ushort[] Triangles = []; // triangle corners, each an index into Indices
    public Submesh[] Submeshes = [];
    public Batch[] Batches = [];

    const uint SKIN = 0x4E494B53;

    public static M2Skin Parse(byte[] data)
    {
        ReadOnlySpan<byte> d = data;
        M2Bin.Require(d, 0, 44, ".skin header");
        if (M2Model.U32(d, 0) != SKIN) throw new InvalidDataException("Not a .skin file (bad magic)");
        var s = new M2Skin();
        s.Indices = U16s(d, 4);
        s.Triangles = U16s(d, 12);

        var (smCount, smOfs) = (M2Model.U32(d, 28), M2Model.U32(d, 32));
        M2Bin.RequireArray(d, (int)smOfs, smCount, 48, ".skin submeshes");
        s.Submeshes = new Submesh[smCount];
        for (var i = 0; i < smCount; i++)
        {
            var o = (int)smOfs + i * 48;
            var level = U16(d, o + 2);
            // Level extends triangleStart past 65535 on large models.
            s.Submeshes[i] = new Submesh(U16(d, o), level, U16(d, o + 4), U16(d, o + 6), U16(d, o + 8) + (level << 16), U16(d, o + 10));
        }

        var (bCount, bOfs) = (M2Model.U32(d, 36), M2Model.U32(d, 40));
        M2Bin.RequireArray(d, (int)bOfs, bCount, 24, ".skin batches");
        s.Batches = new Batch[bCount];
        for (var i = 0; i < bCount; i++)
        {
            var o = (int)bOfs + i * 24;
            s.Batches[i] = new Batch(
                d[o], (sbyte)d[o + 1], U16(d, o + 2), U16(d, o + 4),
                U16(d, o + 6), U16(d, o + 8), U16(d, o + 10), U16(d, o + 12),
                U16(d, o + 14), U16(d, o + 16), U16(d, o + 18), U16(d, o + 20),
                U16(d, o + 22));
        }
        return s;
    }

    static ushort U16(ReadOnlySpan<byte> d, int at) => BinaryPrimitives.ReadUInt16LittleEndian(d[at..]);
    static ushort[] U16s(ReadOnlySpan<byte> d, int at)
    {
        M2Bin.Require(d, at, 8, ".skin ushort array header");
        var (n, ofs) = (M2Model.U32(d, at), M2Model.U32(d, at + 4));
        M2Bin.RequireArray(d, (int)ofs, n, 2, $".skin ushort array at header 0x{at:X}");
        var r = new ushort[n];
        for (var i = 0; i < n; i++) r[i] = U16(d, (int)ofs + i * 2);
        return r;
    }
}
