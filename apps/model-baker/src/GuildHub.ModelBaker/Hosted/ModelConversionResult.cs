namespace GuildHub.ModelBaker.Hosted;

// The item models that could not be converted, and the hard-coded textures the converted ones use.
public sealed record ModelConversionResult(IReadOnlySet<int> Unavailable, IReadOnlySet<int> TextureIds);
