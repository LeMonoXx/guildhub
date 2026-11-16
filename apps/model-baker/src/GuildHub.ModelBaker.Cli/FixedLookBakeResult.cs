using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Cli;

// ManifestPath is relative to the output directory, with '/' separators.
public sealed record FixedLookBakeResult(FixedLookManifest Manifest, string ManifestPath);
