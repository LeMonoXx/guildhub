using System.Text.Json;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Hosted;

public sealed class LookBakeDocument
{
  public string LookHash { get; set; } = "";
  public string? ClientBuild { get; set; }
  public int Race { get; set; }
  public int Sex { get; set; }
  public int ClassId { get; set; } = LookResolver.DefaultClassId;
  public List<LookCustomizationDocument> Customizations { get; set; } = [];
  public List<int> Items { get; set; } = [];
  public List<EquipmentOverrideDocument> EquipmentOverrides { get; set; } = [];
  public List<int>? AnimationIds { get; set; }

  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
  {
    PropertyNameCaseInsensitive = true,
    ReadCommentHandling = JsonCommentHandling.Skip,
    AllowTrailingCommas = true,
  };

  public static LookBakeDocument Parse(string json) =>
      JsonSerializer.Deserialize<LookBakeDocument>(json, Json)
      ?? throw new InvalidDataException("Look JSON was empty.");

  public FixedLookRequest ToRequest(string outputDirectory) =>
      new(
          outputDirectory,
          Race,
          Sex,
          Items,
          AnimationIds is { Count: > 0 } ? AnimationIds : FixedLookBaker.TroopAnimationIds,
          ClassId > 0 ? ClassId : LookResolver.DefaultClassId,
          EquipmentOverrides.Select(o => new EquipmentSlotOverride(o.ItemId, o.EquipSlot)).ToList(),
          string.IsNullOrWhiteSpace(LookHash) ? null : LookHash,
          Customizations
              .Where(c => c.OptionId > 0 && c.ChoiceId > 0)
              .GroupBy(c => c.OptionId)
              .ToDictionary(g => g.Key, g => g.Last().ChoiceId));
}

public sealed class LookCustomizationDocument
{
  public int OptionId { get; set; }
  public int ChoiceId { get; set; }
}

public sealed class EquipmentOverrideDocument
{
  public int ItemId { get; set; }
  public int EquipSlot { get; set; }
}
