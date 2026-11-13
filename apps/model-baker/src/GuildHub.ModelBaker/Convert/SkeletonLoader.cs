// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Numerics;

namespace GuildHub.ModelBaker.Convert;

public interface ISkeletonLoader
{
    byte[] Load(uint skeletonFileDataId, Func<uint, byte[]> open);
}

public sealed class GameFileSkeletonLoader : ISkeletonLoader
{
    public byte[] Load(uint skeletonFileDataId, Func<uint, byte[]> open) =>
        open(skeletonFileDataId);
}

static class SkeletonLoader
{
    public static IM2Skeleton Resolve(
        M2Model model,
        Func<uint, byte[]> open,
        ISkeletonLoader loader)
    {
        if (model.SkeletonFileDataId == 0) return model;

        var skeleton = M2Skel.Parse(loader.Load(model.SkeletonFileDataId, open));
        if (skeleton.Bones.Length == 0)
            throw new InvalidDataException(
                $"Skeleton {model.SkeletonFileDataId} has no bones.");

        // Some files duplicate bind bones in the M2. Refuse a mismatched external hierarchy/pivot:
        // applying those animation nodes to the model's skin would silently produce a wrong bind pose.
        if (model.Bones.Length > 0)
        {
            if (model.Bones.Length != skeleton.Bones.Length)
                throw Incompatible(model, $"bone count {model.Bones.Length} != {skeleton.Bones.Length}");
            for (var i = 0; i < model.Bones.Length; i++)
            {
                if (model.Bones[i].ParentBone != skeleton.Bones[i].ParentBone ||
                    !NearlyEqual(model.Bones[i].Pivot, skeleton.Bones[i].Pivot))
                    throw Incompatible(model, $"bone {i} hierarchy or pivot differs");
            }
        }
        return skeleton;
    }

    static InvalidDataException Incompatible(M2Model model, string reason) =>
        new(
            $"Model skeleton {model.SkeletonFileDataId} is incompatible with the M2 skin bind pose ({reason}); conversion was stopped to avoid incorrect skinning.");

    static bool NearlyEqual(Vector3 left, Vector3 right) =>
        Vector3.DistanceSquared(left, right) <= 1e-10f;
}
