using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Cli.Options;

public sealed record FixedLookOptions(
    string OutputDirectory,
    string CacheDirectory,
    string Region,
    int Race,
    int Sex,
    IReadOnlyList<int> ItemIds,
    IReadOnlyList<int> AnimationIds,
    int ClassId = LookResolver.DefaultClassId,
    IReadOnlyList<EquipmentSlotOverride>? EquipmentOverrides = null)
{
  static readonly int[] DefaultItems = [16820, 19019];
  static readonly int[] DefaultAnimations = [0, 67];

  public static FixedLookOptions Default(SharedBakeOptions shared) =>
      new(
          shared.OutputDirectory,
          shared.CacheDirectory,
          shared.Region,
          1,
          0,
          DefaultItems,
          DefaultAnimations,
          LookResolver.DefaultClassId,
          []);

  public static bool TryParse(
      IReadOnlyList<string> args,
      out FixedLookOptions? options,
      out string? error)
      => TryParse(args, defaults: null, out options, out error);

  public static bool TryParse(
      IReadOnlyList<string> args,
      FixedLookOptions? defaults,
      out FixedLookOptions? options,
      out string? error)
  {
    var start = defaults ?? Default(SharedBakeOptions.Default());
    var race = start.Race;
    var sex = start.Sex;
    var classId = start.ClassId;
    var items = defaults?.ItemIds.ToList() ?? [];
    var animations = defaults?.AnimationIds.ToList() ?? [];
    var equipmentOverrides = defaults?.EquipmentOverrides?.ToList() ?? [];
    var hasItems = defaults != null;
    var hasAnimations = defaults != null;

    string? AddHand(int itemId, int slot)
    {
      if (equipmentOverrides.Any(item => item.EquipSlot == slot))
        return $"Conflicting duplicate equipment slot override for slot {slot}.";
      items.Add(itemId);
      equipmentOverrides.Add(new(itemId, slot));
      hasItems = true;
      return null;
    }

    string? Read(string name, string value)
    {
      switch (name)
      {
        case "--race" when int.TryParse(value, out var parsedRace) && parsedRace > 0:
          race = parsedRace;
          return null;
        case "--sex" when int.TryParse(value, out var parsedSex) && parsedSex is 0 or 1:
          sex = parsedSex;
          return null;
        case "--class" when int.TryParse(value, out var parsedClass) && parsedClass > 0:
          classId = parsedClass;
          return null;
        case "--item" when int.TryParse(value, out var item) && item > 0:
          items.Add(item);
          hasItems = true;
          return null;
        case "--main-hand" when int.TryParse(value, out var mainHand) && mainHand > 0:
          return AddHand(mainHand, ItemResolver.MainHandSlot);
        case "--off-hand" when int.TryParse(value, out var offHand) && offHand > 0:
          return AddHand(offHand, ItemResolver.OffHandSlot);
        case "--animation" when int.TryParse(value, out var animation) && animation >= 0:
          animations.Add(animation);
          hasAnimations = true;
          return null;
        default:
          return SharedBakeOptions.InvalidOption(name, value);
      }
    }

    var startShared = new SharedBakeOptions(start.OutputDirectory, start.CacheDirectory, start.Region);
    if (!SharedBakeOptions.TryParse(args, startShared, Read, out var shared, out error))
    {
      options = null;
      return false;
    }
    options = new(
        shared.OutputDirectory,
        shared.CacheDirectory,
        shared.Region,
        race,
        sex,
        hasItems ? items : DefaultItems,
        hasAnimations ? animations : DefaultAnimations,
        classId,
        equipmentOverrides);
    return true;
  }
}
