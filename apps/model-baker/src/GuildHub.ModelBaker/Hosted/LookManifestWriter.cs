// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Hosted;

public sealed class LookManifestWriter(string build)
{
  public FixedLookManifest Write(
      AssetStoreWriter store,
      string? lookHash,
      CharacterLook look,
      IReadOnlyList<ResolvedItem> items,
      FixedLookAsset body,
      string bodyMetadata,
      IReadOnlyList<FixedLookAnimation> animations)
  {
    look = look with
    {
      Build = build,
      Animations = animations.Select(a => new AnimationInfo(a.Id, a.Name)).ToList(),
    };
    var manifest = new FixedLookManifest(
        1,
        build,
        AssetConverter.OutputVersion,
        look.ForPlayer(),
        items,
        body,
        bodyMetadata,
        animations);

    store.WriteJson(AssetStorePaths.ManifestPath(lookHash), manifest);
    store.WriteJson(
        AssetStorePaths.CurrentPath,
        new { build, fixedLook = AssetStorePaths.ManifestPath(null) });
    return manifest;
  }
}
