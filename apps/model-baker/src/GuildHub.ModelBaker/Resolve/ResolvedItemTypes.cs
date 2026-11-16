// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json.Serialization;

namespace GuildHub.ModelBaker.Resolve;

public sealed record FilePick(
    int FileDataId,
    string Match,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Position = null);

public sealed record ModelSlot(int Slot, int ModelResourcesId, IReadOnlyList<FilePick> Models, IReadOnlyList<FilePick> Textures);

public sealed record BodyTexture(int Section, IReadOnlyList<FilePick> Textures);

public sealed record GeosetChange(int Group, int Geoset);

public sealed record Attachment(int Slot, int AttachmentId, int ModelFileDataId, int? TextureFileDataId);

// An effect model (a weapon glow) attached to the item's own model at its attachment `AttachmentId`,
// whichever hand the item is in.
public sealed record ItemEffect(int AttachmentId, int ModelFileDataId);

// A geoset group a helmet hides. `KeepWithOptionFlags` is HelmetGeosetData's unnamed last column when
// every row for the group sets it (seen: 32), else 0: the group stays when the customization option
// filling it has one of those flags. The Undead jaw (Jaw Features, flags 40) is in groups 1 and 2,
// which Helm of Might hides with 32. The column is undocumented.
public sealed record HelmHide(int Group, int KeepWithOptionFlags);

public sealed record ResolvedItem
{
  public string Build { get; init; } = "";
  public int Race { get; init; }
  public int Sex { get; init; }
  // "hd" or "sd". Item files are chosen by race and sex only: no table the resolver reads
  // distinguishes HD from SD bodies, and item section numbers map onto either body's layout.
  public string ModelSet { get; init; } = "hd";
  public int ItemId { get; init; }
  public string Name { get; init; } = "";
  [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Error { get; init; }
  public int? InventoryType { get; init; }
  public int? EquipSlot { get; init; }
  public int? LayerPriority { get; init; }
  public int? ItemAppearanceId { get; init; }
  public int? ItemDisplayInfoId { get; init; }
  public int[] GeosetGroup { get; init; } = [];
  public int[] AttachmentGeosetGroup { get; init; } = [];
  public IReadOnlyList<int> HelmHideGeosetGroups { get; init; } = [];
  public IReadOnlyList<HelmHide> HelmHides { get; init; } = [];
  public IReadOnlyList<ModelSlot> Models { get; init; } = [];
  public IReadOnlyList<BodyTexture> BodyTextures { get; init; } = [];
  public IReadOnlyList<GeosetChange> Geosets { get; init; } = [];
  public IReadOnlyDictionary<int, int> BodyReplaceableTextures { get; init; } = new Dictionary<int, int>();
  public IReadOnlyList<Attachment> Attachments { get; init; } = [];
  public IReadOnlyList<ItemEffect> Effects { get; init; } = [];
  // Item.SheatheType (where a sheathed weapon goes: 1 back, 2 large weapon on the back, 3 hip,
  // 4 shield on the back, else it stays in hand) and Item.SubclassID (bow, gun, ...).
  public int? SheatheType { get; init; }
  public int? ItemSubclass { get; init; }
}
