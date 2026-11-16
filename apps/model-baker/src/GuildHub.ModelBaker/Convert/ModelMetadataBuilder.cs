// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

static class ModelMetadataBuilder
{
  public static JsonObject Build(
      uint fdid,
      M2Model m2,
      IM2Skeleton skeleton,
      uint skinFdid,
      SkinnedMeshExport mesh,
      int[] embeddedSequences,
      EmbeddedAnimationPolicy animationPolicy,
      JsonArray animations,
      Func<uint, byte[]> open)
  {
    var textures = new JsonArray();
    for (var t = 0; t < m2.Textures.Length; t++)
    {
      var tx = m2.Textures[t];
      textures.Add(new JsonObject { ["index"] = t, ["type"] = tx.Type, ["flags"] = tx.Flags, ["fileDataId"] = tx.Type == 0 ? tx.FileDataId : null });
    }
    var materialAnimations = MaterialAnimationMetadata.Export(m2, skeleton, embeddedSequences, open);

    return new JsonObject
    {
      ["fileDataId"] = fdid,
      ["name"] = m2.Name,
      ["version"] = m2.Version,
      ["flags"] = m2.Flags,
      ["skinFileDataIds"] = new JsonArray(m2.SkinFileDataIds.Select(x => (JsonNode)x).ToArray()),
      ["skinUsed"] = skinFdid,
      ["skeletonFileDataId"] = m2.SkeletonFileDataId == 0 ? null : m2.SkeletonFileDataId,
      ["vertexCount"] = mesh.VertexCount,
      ["m2VertexCount"] = m2.Vertices.Length,
      ["boneCount"] = skeleton.Bones.Length,
      ["reweightedVertices"] = mesh.ReweightedVertices,
      ["sequenceCount"] = skeleton.Sequences.Length,
      ["sequenceIds"] = new JsonArray(skeleton.Sequences.Select(q => (int)q.Id).Distinct().Order().Select(x => (JsonNode)x).ToArray()),
      ["embeddedAnimationPolicy"] = animationPolicy.ToString(),
      ["standVariations"] = new JsonArray(skeleton.Sequences.Select((q, i) => (q, i)).Where(x => x.q.Id == 0)
          .Select(x => (JsonNode)new JsonObject { ["variation"] = x.q.Variation, ["sequenceIndex"] = x.i, ["durationMs"] = x.q.Duration, ["flags"] = x.q.Flags }).ToArray()),
      ["animFiles"] = AnimFileSummary(skeleton, open),
      ["animations"] = animations,
      ["bones"] = mesh.Bones,
      ["coordinateSystem"] = "glTF Y-up: (x, y, z)_wow -> (x, z, -y)",
      ["textures"] = textures,
      ["materials"] = new JsonArray(m2.Materials.Select((x, i) => (JsonNode)new JsonObject { ["index"] = i, ["flags"] = x.Flags, ["blendMode"] = x.BlendMode }).ToArray()),
      ["materialAnimations"] = materialAnimations.tracks,
      ["materialAnimationDiagnostics"] = materialAnimations.diagnostics,
      ["geosets"] = mesh.Geosets,
      ["attachments"] = mesh.Attachments,
      ["particles"] = M2Particles.Export(m2, open),
    };
  }

  // Texture units (skin batches) that draw submesh `si`, resolved through the texture combo table.
  public static JsonArray TextureUnits(M2Model m2, M2Skin skin, int si)
  {
    var list = new JsonArray();
    foreach (var b in skin.Batches.Where(b => b.SkinSectionIndex == si))
    {
      var layers = new JsonArray();
      for (var k = 0; k < Math.Max((int)b.TextureCount, 1); k++) layers.Add(TextureLayer(m2, b, k));
      var mat = b.MaterialIndex < m2.Materials.Length ? m2.Materials[b.MaterialIndex] : null;
      var colorIndex = b.ColorIndex == ushort.MaxValue ? (int?)null : b.ColorIndex;
      list.Add(new JsonObject
      {
        ["flags"] = b.Flags,
        ["priority"] = b.Priority,
        ["shaderId"] = b.ShaderId,
        ["geosetIndex"] = (int)b.GeosetIndex,
        ["colorIndex"] = colorIndex,
        ["colorError"] = colorIndex is int ci && ci >= m2.Colors.Length ? $"color index {ci} is out of range" : null,
        ["materialIndex"] = b.MaterialIndex,
        ["blendMode"] = mat?.BlendMode,
        ["materialFlags"] = mat?.Flags,
        ["materialLayer"] = b.MaterialLayer,
        ["textures"] = layers,
      });
    }
    return list;
  }

  // Which AFID-referenced .anim files exist in local storage. Missing ones are listed, not fetched.
  static JsonObject AnimFileSummary(IM2Skeleton skeleton, Func<uint, byte[]> open)
  {
    var missing = new JsonArray();
    var present = 0;
    foreach (var a in skeleton.AnimFileIds.Where(a => a.FileDataId != 0))
    {
      try { open(a.FileDataId); present++; }
      catch (FileNotFoundException) { missing.Add(new JsonObject { ["animId"] = a.AnimId, ["subAnimId"] = a.SubAnimId, ["fileDataId"] = a.FileDataId }); }
    }
    return new JsonObject { ["afidEntries"] = skeleton.AnimFileIds.Length, ["present"] = present, ["missing"] = missing };
  }

  static JsonObject TextureLayer(M2Model m2, M2Skin.Batch b, int k)
  {
    var coord = ResolveLookup(m2.TextureCoordCombos, b.TextureCoordComboIndex, k, "texture coordinate");
    var weight = ResolveLookup(m2.TextureWeightCombos, b.TextureWeightComboIndex, k, "texture weight");
    var transform = ResolveLookup(m2.TextureTransformCombos, b.TextureTransformComboIndex, k, "texture transform");
    var layer = new JsonObject
    {
      ["textureCoordIndex"] = coord.value,
      ["textureWeightIndex"] = weight.value,
      ["textureTransformIndex"] = transform.value,
    };
    var errors = new JsonArray();
    foreach (var error in new[] { coord.error, weight.error, transform.error })
      if (error != null) errors.Add(error);
    var textureError = ResolveTexture(m2, b.TextureComboIndex + k, layer);
    if (textureError != null) errors.Add(textureError);
    if (errors.Count > 0) layer["errors"] = errors;
    return layer;
  }

  static string? ResolveTexture(M2Model m2, int combo, JsonObject layer)
  {
    if (combo >= m2.TextureCombos.Length) return $"texture combo {combo} is out of range";
    var ti = m2.TextureCombos[combo];
    if (ti == ushort.MaxValue)
    {
      layer["textureIndex"] = null;
      return null;
    }
    layer["textureIndex"] = ti;
    if (ti >= m2.Textures.Length) return $"texture index {ti} is out of range";
    var tx = m2.Textures[ti];
    layer["type"] = tx.Type;
    layer["fileDataId"] = tx.Type == 0 ? tx.FileDataId : null;
    return null;
  }

  static (int? value, string? error) ResolveLookup(ushort[] lookup, ushort start, int layer, string name)
  {
    if (lookup.Length == 0) return (null, null);
    if (start == ushort.MaxValue) return (null, null);
    var combo = start + layer;
    if (combo >= lookup.Length) return (null, $"{name} combo {combo} is out of range");
    var value = lookup[combo];
    return value == ushort.MaxValue ? (null, null) : (value, null);
  }
}
