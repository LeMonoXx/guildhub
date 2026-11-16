using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Hosted;

public sealed record LookBakePlan(IReadOnlyList<ResolvedItem> Items, int BodyFileDataId);
