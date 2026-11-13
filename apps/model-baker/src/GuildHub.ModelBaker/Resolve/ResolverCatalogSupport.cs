// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Tables;
using T = GuildHub.ModelBaker.Tables.GameTableNames;

namespace GuildHub.ModelBaker.Resolve;

// The two catalog operations the resolvers need. Keeping them here avoids bringing Altrobe's item
// search, set catalogs, druid forms, identity generator, and other dressing-room catalog features.
public enum ModelSet { Hd, Sd }

internal static class ResolverCatalogSupport
{
    public static Dictionary<int, int> SdVariants(ITables tables) =>
        tables.Has(T.ChrModelAltVariant)
            ? tables.Get(T.ChrModelAltVariant).ById("SourceChrModelID")
                .ToDictionary(kv => kv.Key, kv => kv.Value.Int("VariantChrModelID"))
            : [];

    // The appearance an item shows by default: lowest modifier, then lowest OrderIndex.
    public static Row PrimaryAppearance(IEnumerable<Row> modifiedAppearances) => modifiedAppearances
        .OrderBy(r => r.Int("ItemAppearanceModifierID"))
        .ThenBy(r => r.Int("OrderIndex"))
        .First();
}
