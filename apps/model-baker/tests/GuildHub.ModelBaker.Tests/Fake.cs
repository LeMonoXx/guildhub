// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

namespace GuildHub.ModelBaker.Tests;

static class Fake
{
    public static IReadOnlyDictionary<string, object?> R(params (string column, object? value)[] cells) =>
        cells.ToDictionary(c => c.column, c => c.value);
}

// Behaves like the real table loader: a table the build doesn't have throws on Get, and Has says so.
sealed class StrictTables(GuildHub.ModelBaker.Tables.InMemoryTables inner, params string[] present) : GuildHub.ModelBaker.Tables.ITables
{
    public IReadOnlyList<GuildHub.ModelBaker.Tables.Row> Get(string table) =>
        Has(table) ? inner.Get(table) : throw new FileNotFoundException($"Table {table} is not in this build");

    public bool Has(string table) => present.Contains(table, StringComparer.OrdinalIgnoreCase);
}
