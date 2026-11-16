// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text;
using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

// Owns the byte-sensitive glTF buffer/accessor layout shared by model and animation exports.
sealed class GltfBinaryBuilder
{
    readonly MemoryStream _bin = new();

    public JsonArray BufferViews { get; } = [];
    public JsonArray Accessors { get; } = [];
    public long Length => _bin.Length;

    public static byte[] Bytes<T>(T[] values) where T : struct =>
        System.Runtime.InteropServices.MemoryMarshal.AsBytes(values.AsSpan()).ToArray();

    public void Pad()
    {
        while (_bin.Length % 4 != 0) _bin.WriteByte(0);
    }

    public int AddView(byte[] bytes, int? target = null)
    {
        while (_bin.Length % 4 != 0) _bin.WriteByte(0);
        var view = new JsonObject
        {
            ["buffer"] = 0,
            ["byteOffset"] = _bin.Length,
            ["byteLength"] = bytes.Length,
        };
        if (target != null) view["target"] = target;
        _bin.Write(bytes);
        BufferViews.Add(view);
        return BufferViews.Count - 1;
    }

    public int AddAccessor(
        int view,
        int componentType,
        int count,
        string type,
        JsonArray? min = null,
        JsonArray? max = null)
    {
        var accessor = new JsonObject
        {
            ["bufferView"] = view,
            ["componentType"] = componentType,
            ["count"] = count,
            ["type"] = type,
        };
        if (min != null)
        {
            accessor["min"] = min;
            accessor["max"] = max;
        }
        Accessors.Add(accessor);
        return Accessors.Count - 1;
    }

    public byte[] Build(JsonObject gltf)
    {
        Pad();
        gltf["accessors"] ??= Accessors;
        gltf["bufferViews"] ??= BufferViews;
        gltf["buffers"] ??= new JsonArray(new JsonObject { ["byteLength"] = _bin.Length });

        var bin = _bin.ToArray();
        var json = Encoding.UTF8.GetBytes(gltf.ToJsonString());
        var jsonPad = (4 - json.Length % 4) % 4;
        var total = 12 + 8 + json.Length + jsonPad + 8 + bin.Length;
        using var output = new MemoryStream(total);
        using var writer = new BinaryWriter(output);
        writer.Write(0x46546C67u);
        writer.Write(2u);
        writer.Write((uint)total);
        writer.Write((uint)(json.Length + jsonPad));
        writer.Write(0x4E4F534Au);
        writer.Write(json);
        for (var i = 0; i < jsonPad; i++) writer.Write((byte)0x20);
        writer.Write((uint)bin.Length);
        writer.Write(0x004E4942u);
        writer.Write(bin);
        return output.ToArray();
    }
}
