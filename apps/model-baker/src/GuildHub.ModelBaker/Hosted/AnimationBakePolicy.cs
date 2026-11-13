// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;

namespace GuildHub.ModelBaker.Hosted;

public interface IAnimationBakePolicy
{
    IEnumerable<int> Select(FixedLookAnimationRequest request);
}

public sealed record FixedLookAnimationRequest(
    int RaceId,
    int Sex,
    IReadOnlyList<int> RequestedAnimationIds,
    IReadOnlySet<int> AvailableAnimationIds);

// Selection stays data-driven: callers supply the desired clips and this policy applies model and
// race/sex availability without leaking animation rules into bake orchestration.
public sealed class RequestedAnimationBakePolicy : IAnimationBakePolicy
{
    public IEnumerable<int> Select(FixedLookAnimationRequest request) =>
        request.RequestedAnimationIds
            .Distinct()
            .Where(id =>
                request.AvailableAnimationIds.Contains(id) &&
                AnimationNames.Compatible(id, request.RaceId, request.Sex));
}
