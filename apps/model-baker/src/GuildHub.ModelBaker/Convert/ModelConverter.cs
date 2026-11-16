// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

// Portions ported from wow.export (https://github.com/Kruithne/wow.export), MIT License, Copyright (c) Kruithne and Marlamin.
//
// Converts an M2 + its first .skin into a skinned binary glTF (.glb) plus a metadata JSON.
// Coordinate conversion follows wow.export's M2Loader: WoW (x, y, z) Z-up -> glTF (x, z, -y) Y-up.
// That mapping is a proper rotation, so triangle winding stays as stored.

using System.Numerics;
using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

static class ModelConverter
{
  public static Vector3 ToGltf(Vector3 v) => new(v.X, v.Z, -v.Y);

  public record Result(JsonObject Meta, byte[] Glb, uint[] HardcodedTextures);

  public static Result Convert(
      uint fdid,
      M2Model m2,
      IM2Skeleton skeleton,
      uint skinFdid,
      M2Skin skin,
      Func<uint, byte[]> open,
      EmbeddedAnimationPolicy animationPolicy)
  {
    var binary = new GltfBinaryBuilder();
    var mesh = SkinnedMeshExporter.Export(fdid, m2, skeleton, skin, binary);

    // Body models keep the historical Stand-only payload; attached/effect models can request
    // every supported sequence without adding model-role branches to conversion.
    var embeddedSequences = ModelAnimationExporter.EmbeddedSequences(skeleton.Sequences, animationPolicy);
    var (animations, animationMetadata) = ModelAnimationExporter.ExportEmbedded(
        m2,
        skeleton,
        embeddedSequences,
        animationPolicy,
        open,
        binary,
        mesh.BoneBase);

    binary.Pad();
    var gltf = new JsonObject
    {
      ["asset"] = new JsonObject { ["version"] = "2.0", ["generator"] = "altrobe probe convert-model" },
      ["scene"] = 0,
      ["scenes"] = new JsonArray(new JsonObject { ["nodes"] = mesh.SceneNodes }),
      ["nodes"] = mesh.Nodes,
      ["skins"] = mesh.Skins,
      ["meshes"] = mesh.Meshes,
      ["accessors"] = binary.Accessors,
      ["bufferViews"] = binary.BufferViews,
      ["buffers"] = new JsonArray(new JsonObject { ["byteLength"] = binary.Length }),
    };
    if (animations.Count > 0) gltf["animations"] = animations;

    var meta = ModelMetadataBuilder.Build(
        fdid,
        m2,
        skeleton,
        skinFdid,
        mesh,
        embeddedSequences,
        animationPolicy,
        animationMetadata,
        open);

    var hardcoded = m2.Textures.Where(t => t.Type == 0 && t.FileDataId != 0).Select(t => t.FileDataId).Distinct().ToArray();
    return new Result(meta, binary.Build(gltf), hardcoded);
  }

  public static string BoneName(int i) => $"bone_{i}";

  internal static int[] SequencesFor(M2Sequence[] seqs, int animId) =>
      ModelAnimationExporter.SequencesFor(seqs, animId);

  public static byte[]? ConvertAnimation(
      M2Model m2,
      IM2Skeleton skeleton,
      int animId,
      Func<uint, byte[]> open,
      out JsonObject meta) =>
      ModelAnimationExporter.ConvertAnimation(m2, skeleton, animId, open, out meta);
}
