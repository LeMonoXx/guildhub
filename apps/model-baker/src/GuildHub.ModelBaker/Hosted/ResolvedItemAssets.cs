// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Hosted;

public static class ResolvedItemAssets
{
  public static List<int> ModelIds(IEnumerable<ResolvedItem> items) =>
      items
          .SelectMany(ModelIds)
          .Distinct()
          .Order()
          .ToList();

  public static IEnumerable<int> TextureIds(ResolvedItem item) =>
      item.Models.SelectMany(m => m.Textures).Select(t => t.FileDataId)
          .Concat(item.BodyTextures.SelectMany(t => t.Textures).Select(t => t.FileDataId))
          .Concat(item.Attachments.Select(a => a.TextureFileDataId).OfType<int>())
          .Concat(item.BodyReplaceableTextures.Values);

  public static IReadOnlyList<ResolvedItem> WithoutModels(
      IReadOnlyList<ResolvedItem> items,
      IReadOnlySet<int> unavailable)
  {
    if (unavailable.Count == 0) return items;
    return items.Select(item => WithoutModels(item, unavailable)).ToList();
  }

  // Some item models are listed in root but absent from every CDN archive. The item keeps its
  // textures and geosets; only the models the client could never load leave the manifest.
  public static ResolvedItem WithoutModels(ResolvedItem item, IReadOnlySet<int> unavailable) => item with
  {
    Models = item.Models
        .Select(slot => slot with { Models = slot.Models.Where(m => !unavailable.Contains(m.FileDataId)).ToList() })
        .ToList(),
    Attachments = item.Attachments.Where(a => !unavailable.Contains(a.ModelFileDataId)).ToList(),
    Effects = item.Effects.Where(e => !unavailable.Contains(e.ModelFileDataId)).ToList(),
  };

  static IEnumerable<int> ModelIds(ResolvedItem item) =>
      item.Models.SelectMany(m => m.Models).Select(m => m.FileDataId)
          .Concat(item.Attachments.Select(a => a.ModelFileDataId))
          .Concat(item.Effects.Select(e => e.ModelFileDataId));
}
