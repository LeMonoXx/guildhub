// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

// Portions ported from wow.export (https://github.com/Kruithne/wow.export), MIT License, Copyright (c) Kruithne and Marlamin.
// Bone math follows src/js/3D/renderers/M2RendererGL.js (_update_bone_matrices) and the skin
// layout follows src/js/3D/writers/GLTFWriter.js.
//
// Bones: an M2 bone's model-space matrix is parent * T(pivot) * T(anim) * R(anim) * S(anim) * T(-pivot),
// and vertices are stored in bind pose, so that matrix is the skinning matrix directly. Each bone
// becomes a glTF node "bone_<index>" whose global transform is that matrix times T(pivot). Its local
// TRS is then translation = pivot - parentPivot + T(anim), rotation = R(anim), scale = S(anim), and its
// inverse bind matrix is T(-pivot).

using System.Numerics;
using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

static class SkinnedMeshExporter
{
  const int ArrayBuffer = 34962, ElementArrayBuffer = 34963, Float = 5126, UShort = 5123, UByte = 5121;

  public static SkinnedMeshExport Export(
      uint fdid,
      M2Model m2,
      IM2Skeleton skeleton,
      M2Skin skin,
      GltfBinaryBuilder binary)
  {
    var vertices = WriteVertices(m2, skeleton, skin, binary);
    var meshes = new JsonArray();
    var nodes = new JsonArray();
    var children = new JsonArray();
    var geosets = new JsonArray();
    WriteSubmeshes(m2, skin, binary, vertices, meshes, nodes, children, geosets);

    // Bones: node "bone_<index>" for M2 bone <index>, so later steps can find them by name.
    var boneCount = skeleton.Bones.Length;
    var boneBase = nodes.Count;
    var bonesMeta = new JsonArray();
    var ibm = new float[boneCount * 16];
    for (var i = 0; i < boneCount; i++)
    {
      var b = skeleton.Bones[i];
      var p = ModelConverter.ToGltf(b.Pivot);
      var pp = b.ParentBone >= 0 ? ModelConverter.ToGltf(skeleton.Bones[b.ParentBone].Pivot) : Vector3.Zero;
      var t = p - pp;
      nodes.Add(new JsonObject
      {
        ["name"] = ModelConverter.BoneName(i),
        ["translation"] = new JsonArray(t.X, t.Y, t.Z),
        ["extras"] = new JsonObject { ["bone"] = i, ["keyBoneId"] = b.KeyBoneId },
      });
      // Column-major T(-pivot).
      ibm[i * 16] = ibm[i * 16 + 5] = ibm[i * 16 + 10] = ibm[i * 16 + 15] = 1;
      (ibm[i * 16 + 12], ibm[i * 16 + 13], ibm[i * 16 + 14]) = (-p.X, -p.Y, -p.Z);
      bonesMeta.Add(new JsonObject
      {
        ["index"] = i,
        ["node"] = ModelConverter.BoneName(i),
        ["keyBoneId"] = b.KeyBoneId,
        ["parent"] = b.ParentBone,
        ["flags"] = b.Flags,
        ["pivotGltf"] = new JsonArray(p.X, p.Y, p.Z),
      });
    }
    var skeletonRoots = new JsonArray();
    void AddChild(int parentNode, int child) => ((nodes[parentNode]!["children"] ??= new JsonArray()) as JsonArray)!.Add(child);
    for (var i = 0; i < boneCount; i++)
    {
      var parent = skeleton.Bones[i].ParentBone;
      if (parent >= 0 && parent < boneCount) AddChild(boneBase + parent, boneBase + i);
      else skeletonRoots.Add(boneBase + i);
    }

    // Attachment points are bone-relative. wow.export places one at boneMatrix * T(position), so as
    // a child of the bone node its offset is position - pivot (glTF axes). It follows the animation.
    var attachments = new JsonArray();
    foreach (var a in m2.Attachments)
    {
      var g = ModelConverter.ToGltf(a.Position);
      var hasBone = a.Bone < boneCount;
      var offset = hasBone ? g - ModelConverter.ToGltf(skeleton.Bones[a.Bone].Pivot) : g;
      nodes.Add(new JsonObject
      {
        ["name"] = $"attachment_{a.Id}",
        ["translation"] = new JsonArray(offset.X, offset.Y, offset.Z),
        ["extras"] = new JsonObject { ["attachmentId"] = a.Id, ["bone"] = a.Bone },
      });
      if (hasBone) AddChild(boneBase + a.Bone, nodes.Count - 1);
      else skeletonRoots.Add(nodes.Count - 1);
      attachments.Add(new JsonObject
      {
        ["id"] = a.Id,
        ["bone"] = a.Bone,
        ["boneNode"] = hasBone ? ModelConverter.BoneName(a.Bone) : null,
        ["offsetGltf"] = new JsonArray(offset.X, offset.Y, offset.Z),
        ["position"] = new JsonArray(a.Position.X, a.Position.Y, a.Position.Z),
        ["positionGltf"] = new JsonArray(g.X, g.Y, g.Z),
      });
    }

    nodes.Add(new JsonObject { ["name"] = $"skeleton_{fdid}", ["children"] = skeletonRoots });
    var skeletonNode = nodes.Count - 1;
    children.Add(skeletonNode);
    var ibmAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(ibm)), Float, boneCount, "MAT4");
    var skins = new JsonArray(new JsonObject
    {
      ["name"] = $"m2_{fdid}_skin",
      ["joints"] = new JsonArray(Enumerable.Range(boneBase, boneCount).Select(x => (JsonNode)x).ToArray()),
      ["inverseBindMatrices"] = ibmAcc,
      ["skeleton"] = skeletonNode,
    });

    return new(
        nodes,
        children,
        meshes,
        skins,
        geosets,
        bonesMeta,
        attachments,
        boneBase,
        vertices.Count,
        vertices.Reweighted);
  }

  static VertexAccessors WriteVertices(M2Model m2, IM2Skeleton skeleton, M2Skin skin, GltfBinaryBuilder binary)
  {
    // Shared vertex attributes for every primitive. Only the vertices this skin references are
    // written, in skin order, so triangle values (indices into skin.Indices) index them directly.
    // Body models carry far more M2 vertices than the first skin uses (917116: 288020 vs 46799).
    var n = skin.Indices.Length;
    var pos = new float[n * 3];
    var nor = new float[n * 3];
    var uv = new float[n * 2];
    var lo = new Vector3(float.MaxValue);
    var hi = new Vector3(float.MinValue);
    for (var i = 0; i < n; i++)
    {
      var v = m2.Vertices[skin.Indices[i]];
      var p = ModelConverter.ToGltf(v.Position);
      var nn = ModelConverter.ToGltf(v.Normal);
      // glTF requires unit-length normals. Zero normals get an arbitrary up vector.
      nn = nn.LengthSquared() > 1e-12f ? Vector3.Normalize(nn) : Vector3.UnitY;
      lo = Vector3.Min(lo, p);
      hi = Vector3.Max(hi, p);
      (pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) = (p.X, p.Y, p.Z);
      (nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) = (nn.X, nn.Y, nn.Z);
      (uv[i * 2], uv[i * 2 + 1]) = (v.Uv0.X, v.Uv0.Y);
    }
    // Skinning: each M2 vertex has four bone indices and four uint8 weights. wow.export passes the
    // indices through as global bone indices (no remap through the skin's bone lookup), so this does too.
    var boneCount = skeleton.Bones.Length;
    if (boneCount == 0 || boneCount > 256) throw new InvalidDataException($"Unsupported bone count {boneCount}");
    var joints = new byte[n * 4];
    var weights = new byte[n * 4];
    var reweighted = 0;
    for (var i = 0; i < n; i++)
    {
      var v = m2.Vertices[skin.Indices[i]];
      var sum = 0;
      for (var k = 0; k < 4; k++)
      {
        var w = (byte)(v.BoneWeights >> (8 * k));
        var j = (byte)(v.BoneIndices >> (8 * k));
        if (w > 0 && j >= boneCount) throw new InvalidDataException($"Vertex {skin.Indices[i]} references bone {j} of {boneCount}");
        weights[i * 4 + k] = w;
        joints[i * 4 + k] = w > 0 ? j : (byte)0;
        sum += w;
      }
      if (sum == 255) continue;
      // glTF requires weights that sum to 1. Rescale, then give the rounding remainder to the largest.
      reweighted++;
      if (sum == 0) { weights[i * 4] = 255; joints[i * 4] = 0; continue; }
      var total = 0;
      for (var k = 0; k < 4; k++) total += weights[i * 4 + k] = (byte)(weights[i * 4 + k] * 255 / sum);
      var big = Enumerable.Range(0, 4).MaxBy(k => weights[i * 4 + k]);
      weights[i * 4 + big] += (byte)(255 - total);
    }

    var posAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(pos), ArrayBuffer), Float, n, "VEC3", [lo.X, lo.Y, lo.Z], [hi.X, hi.Y, hi.Z]);
    var norAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(nor), ArrayBuffer), Float, n, "VEC3");
    var uvAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(uv), ArrayBuffer), Float, n, "VEC2");
    var jointAcc = binary.AddAccessor(binary.AddView(joints, ArrayBuffer), UByte, n, "VEC4");
    var weightAcc = binary.AddAccessor(binary.AddView(weights, ArrayBuffer), UByte, n, "VEC4");
    binary.Accessors[weightAcc]!["normalized"] = true;
    return new(n, reweighted, posAcc, norAcc, uvAcc, jointAcc, weightAcc);
  }

  static void WriteSubmeshes(
      M2Model m2,
      M2Skin skin,
      GltfBinaryBuilder binary,
      VertexAccessors vertices,
      JsonArray meshes,
      JsonArray nodes,
      JsonArray children,
      JsonArray geosets)
  {
    for (var si = 0; si < skin.Submeshes.Length; si++)
    {
      var sm = skin.Submeshes[si];
      var idx = new ushort[sm.TriangleCount];
      Array.Copy(skin.Triangles, sm.TriangleStart, idx, 0, sm.TriangleCount);

      var units = ModelMetadataBuilder.TextureUnits(m2, skin, si);
      var name = $"geoset_{sm.SkinSectionId}";
      var extras = new JsonObject { ["geosetId"] = (int)sm.SkinSectionId, ["submeshIndex"] = si };

      if (idx.Length > 0)
      {
        var idxAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(idx), ElementArrayBuffer), UShort, idx.Length, "SCALAR");
        meshes.Add(new JsonObject
        {
          ["name"] = name,
          ["primitives"] = new JsonArray(new JsonObject
          {
            ["attributes"] = new JsonObject { ["POSITION"] = vertices.Position, ["NORMAL"] = vertices.Normal, ["TEXCOORD_0"] = vertices.Uv, ["JOINTS_0"] = vertices.Joints, ["WEIGHTS_0"] = vertices.Weights },
            ["indices"] = idxAcc,
            ["mode"] = 4,
          }),
        });
        // Skinned mesh nodes sit at the scene root: glTF ignores their transform anyway.
        nodes.Add(new JsonObject { ["name"] = name, ["mesh"] = meshes.Count - 1, ["skin"] = 0, ["extras"] = extras });
        children.Add(nodes.Count - 1);
      }

      geosets.Add(new JsonObject
      {
        ["submeshIndex"] = si,
        ["geosetId"] = (int)sm.SkinSectionId,
        ["group"] = sm.SkinSectionId / 100,
        ["variant"] = sm.SkinSectionId % 100,
        ["triangles"] = sm.TriangleCount / 3,
        ["vertices"] = sm.VertexCount,
        ["textureUnits"] = units,
      });
    }
  }

  readonly record struct VertexAccessors(
      int Count,
      int Reweighted,
      int Position,
      int Normal,
      int Uv,
      int Joints,
      int Weights);
}
