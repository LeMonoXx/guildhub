// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Hosted;

public sealed record FixedLookRequest(
    string OutputDirectory,
    int Race,
    int Sex,
    IReadOnlyList<int> ItemIds,
    IReadOnlyList<int>? AnimationIds = null,
    int ClassId = LookResolver.DefaultClassId,
    IReadOnlyList<EquipmentSlotOverride>? EquipmentOverrides = null,
    string? LookHash = null,
    IReadOnlyDictionary<int, int>? Customizations = null);

public sealed record FixedLookAsset(string Path, int FileDataId);

public sealed record FixedLookAnimation(int Id, string Name, string Path);

public sealed record FixedLookManifest(
    int SchemaVersion,
    string Build,
    int OutputVersion,
    CharacterLook Look,
    IReadOnlyList<ResolvedItem> Items,
    FixedLookAsset Body,
    string BodyMetadata,
    IReadOnlyList<FixedLookAnimation> Animations);
