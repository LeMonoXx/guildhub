// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using TACTSharp;
using static TACTSharp.RootInstance;

namespace GuildHub.ModelBaker.Storage;

// Selected from Altrobe's LocalFiles helper because TACT roots may contain multiple entries for one
// file. This project has no local-install adapter; the same ordering is required for CDN reads.
public static class LocalFiles
{
    const ContentFlags HighResTexture = ContentFlags.F00000001;

    public static IReadOnlyList<T> Order<T>(
        IEnumerable<T> entries,
        Func<T, ContentFlags> flags,
        Func<T, LocaleFlags>? locale = null,
        LocaleFlags want = LocaleFlags.enUS) => entries
        .OrderByDescending(e => locale == null || (locale(e) & want) != 0)
        .ThenByDescending(e => (flags(e) & HighResTexture) != 0)
        .ThenBy(e => (flags(e) & ContentFlags.LowViolence) != 0)
        .ToList();

    public static (byte[] bytes, T entry) Open<T>(
        IReadOnlyCollection<T> entries,
        Func<T, ContentFlags> flags,
        Func<T, byte[]> read,
        uint fdid,
        Func<T, LocaleFlags>? locale = null)
    {
        if (entries.Count == 0) throw new FileNotFoundException($"FileDataID {fdid} is not in root");
        foreach (var entry in Order(entries, flags, locale))
        {
            try { return (read(entry), entry); }
            catch (FileNotFoundException) { }
        }
        throw new FileNotFoundException($"FileDataID {fdid}: none of {entries.Count} root entries could be read");
    }

    public static (byte[] bytes, ContentFlags flags) Open(BuildInstance build, uint fdid)
    {
        var entries = build.Root!.GetEntriesByFDID(fdid);
        var (bytes, entry) = Open(entries, e => e.contentFlags, e => build.OpenFileByCKey(e.md5.AsSpan()), fdid, e => e.localeFlags);
        return (bytes, entry.contentFlags);
    }
}
