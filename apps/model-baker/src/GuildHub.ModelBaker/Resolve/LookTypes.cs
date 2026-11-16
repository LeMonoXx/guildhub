// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json.Serialization;

namespace GuildHub.ModelBaker.Resolve;

// The raw CharComponentTextureLayouts column names, which the web app reads.
public sealed record LayoutInfo(
    [property: JsonPropertyName("ID")] int Id,
    [property: JsonPropertyName("Width")] int Width,
    [property: JsonPropertyName("Height")] int Height);

public sealed record TextureSize(int TextureType, int Width, int Height);

public sealed record SectionRect(int SectionType, int X, int Y, int Width, int Height);

public sealed record SectionLayer(int SectionType, int TextureType, int BlendMode, int FromLayer);

public sealed record AnimationInfo(int Id, string Name);

public sealed record GeosetsFromChoice(int OptionId, int ChoiceId, IReadOnlyList<int> Geosets);

public sealed record TextureLayer
{
  public int TextureType { get; init; }
  public int Layer { get; init; }
  public int BlendMode { get; init; }
  public int Target { get; init; }
  public SectionRect Section { get; init; } = null!;
  public int FileDataId { get; init; }
  public int ChoiceId { get; init; }
  public int OptionId { get; init; }
  public int MaterialResourcesId { get; init; }
  [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public int[]? Candidates { get; init; }
  // Set on per-choice layers that apply only while this other choice is also active.
  [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public int? RelatedChoiceId { get; init; }
}

// The default choice of one option, in tools/looks/looks.ts's shape.
public sealed record LookChoice(
    int OptionId,
    string Option,
    long OptionFlags,
    int? ChoiceId,
    string Choice,
    int? OrderIndex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Skipped,
    int EligibleChoices,
    int TotalChoices,
    int? WowExportChoiceId);

// One selectable choice and what it changes: the geosets it shows (after the option's own
// geosets are turned off) and the texture layers it paints.
public sealed record ChoiceInfo(
    int ChoiceId,
    string Name,
    int OrderIndex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Swatch,
    bool IsDefault,
    IReadOnlyList<int> Geosets,
    IReadOnlyList<TextureLayer> Layers);

// Every choice a fresh character of the look's class can pick, by OrderIndex then ID. Geosets
// lists every geoset any choice of the option names, which a choice change turns off first.
public sealed record OptionInfo(
    int OptionId,
    string Name,
    long Flags,
    int OrderIndex,
    int? DefaultChoiceId,
    IReadOnlyList<int> Geosets,
    IReadOnlyList<ChoiceInfo> Choices,
    // False when character creation shows no dropdown for it: fewer than two choices to pick from, or
    // the option itself needs a requirement creation does not offer (HD Eye Style, on every race).
    bool Offered = true);

public sealed record CharacterLook
{
  public string Build { get; init; } = "";
  public int Race { get; init; }
  public int Sex { get; init; }
  public int ClassId { get; init; }
  public string Models { get; init; } = "hd";
  public int OverrideArchive { get; init; }
  public int ChrModelId { get; init; }
  public int HdChrModelId { get; init; }
  public int ModelFileDataId { get; init; }
  public int TextureLayoutId { get; init; }
  public LayoutInfo Layout { get; init; } = null!;
  public IReadOnlyList<TextureSize> Textures { get; init; } = [];
  public IReadOnlyList<SectionRect> Sections { get; init; } = [];
  public IReadOnlyList<SectionLayer> SectionLayers { get; init; } = [];
  public IReadOnlyList<LookChoice> Choices { get; init; } = [];
  public IReadOnlyList<int> Geosets { get; init; } = [];
  // Every geoset in the body mesh. The web app drops choice geosets that are not in it.
  public IReadOnlyList<int> MeshGeosets { get; init; } = [];
  public IReadOnlyList<TextureLayer> Layers { get; init; } = [];
  // Animations the body model has, by AnimationData ID, with names from AnimationNames.
  public IReadOnlyList<AnimationInfo> Animations { get; init; } = [];
  public IReadOnlyList<OptionInfo> Options { get; init; } = [];
  public IReadOnlyList<GeosetsFromChoice> GeosetsFromChoices { get; init; } = [];
  public IReadOnlyList<Dictionary<string, int>> UnsupportedElements { get; init; } = [];
  public IReadOnlyList<string> Notes { get; init; } = [];

  // The look as players get it: only the options character creation offers. Hidden options keep
  // their defaults in Choices, Geosets and Layers.
  public CharacterLook ForPlayer() => this with { Options = Options.Where(o => o.Offered).ToList() };
}
