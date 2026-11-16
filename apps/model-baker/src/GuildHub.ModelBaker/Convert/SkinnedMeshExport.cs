using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

// The glTF scene parts of a skinned model, plus the per-geoset, per-bone and per-attachment
// metadata gathered while writing them.
sealed record SkinnedMeshExport(
    JsonArray Nodes,
    JsonArray SceneNodes,
    JsonArray Meshes,
    JsonArray Skins,
    JsonArray Geosets,
    JsonArray Bones,
    JsonArray Attachments,
    int BoneBase,
    int VertexCount,
    int ReweightedVertices);
