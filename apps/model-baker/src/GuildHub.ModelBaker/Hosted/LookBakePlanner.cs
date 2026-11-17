// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Resolve;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Hosted;

/// <summary>
/// Decides what a bake converts: the equipped items, the HD body, the look on that body and the
/// animations the body can play. Converts nothing itself.
/// </summary>
public sealed class LookBakePlanner
{
  readonly string _build;
  readonly IAnimationBakePolicy _animationPolicy;
  readonly LookResolver _looks;
  readonly ItemResolver _items;

  public LookBakePlanner(ITables tables, string build, IAnimationBakePolicy animationPolicy)
  {
    _build = build;
    _animationPolicy = animationPolicy;
    _looks = new(tables);
    _items = new(tables);
  }

  public LookBakePlan Plan(FixedLookRequest request, Action<string>? log)
  {
    if (request.ClassId <= 0)
      throw new ArgumentOutOfRangeException(
          nameof(request.ClassId),
          request.ClassId,
          "Class ID must be positive.");
    var items = ResolveItems(request, log);
    var body = _looks.Body(request.Race, request.Sex, ModelSet.Hd)
        ?? throw new InvalidOperationException(
            $"No HD body exists for race {request.Race}, sex {request.Sex}.");
    return new(items, body.bodyFileDataId);
  }

  public int? BodyFileDataId(int race, int sex) =>
      _looks.Body(race, sex, ModelSet.Hd)?.bodyFileDataId;

  public CharacterLook ResolveLook(FixedLookRequest request, byte[] bodyMetadata) =>
      _looks.Resolve(
          request.Race,
          request.Sex,
          request.ClassId,
          ModelSet.Hd,
          _ => AssetConverter.GeosetIds(bodyMetadata),
          request.Customizations)
      ?? throw new InvalidOperationException(
          $"The default look could not be resolved for race {request.Race}, sex {request.Sex}.");

  // Every texture a race and sex can show before any gear: the body's own and every layer of
  // every customization choice.
  public HashSet<int> PrebakeTextureIds(int race, int sex, byte[] bodyMetadata)
  {
    var look = _looks.Resolve(
        race,
        sex,
        LookResolver.DefaultClassId,
        ModelSet.Hd,
        _ => AssetConverter.GeosetIds(bodyMetadata),
        customizations: null);
    var textureIds = new HashSet<int>(AssetConverter.TextureIds(bodyMetadata));
    if (look != null)
    {
      foreach (var layer in look.Layers.Concat(
          look.Options.SelectMany(option => option.Choices).SelectMany(choice => choice.Layers)))
      {
        textureIds.Add(layer.FileDataId);
        if (layer.Candidates != null) textureIds.UnionWith(layer.Candidates);
      }
    }
    textureIds.Remove(0);
    return textureIds;
  }

  public List<int> SelectAnimations(
      int race,
      int sex,
      IReadOnlyList<int> requestedAnimationIds,
      byte[] bodyMetadata)
  {
    var sequenceIds = AssetConverter.SequenceIds(bodyMetadata).ToHashSet();
    return _animationPolicy.Select(new(race, sex, requestedAnimationIds, sequenceIds)).ToList();
  }

  public List<int> SelectLookAnimations(
      FixedLookRequest request,
      IReadOnlyList<int> requestedAnimationIds,
      int bodyFileDataId,
      byte[] bodyMetadata,
      Action<string>? log)
  {
    var selected = SelectAnimations(request.Race, request.Sex, requestedAnimationIds, bodyMetadata);
    var selectedSet = selected.ToHashSet();
    foreach (var animationId in requestedAnimationIds.Distinct().Where(id => !selectedSet.Contains(id)))
      log?.Invoke(
          $"animation {AnimationNames.Name(animationId)} ({animationId}) unavailable for " +
          $"body {bodyFileDataId}, race {request.Race}, sex {request.Sex}; skipped");
    return selected;
  }

  List<ResolvedItem> ResolveItems(FixedLookRequest request, Action<string>? log)
  {
    var duplicateOverrides = (request.EquipmentOverrides ?? [])
        .GroupBy(o => o.ItemId)
        .FirstOrDefault(group => group.Count() > 1);
    if (duplicateOverrides != null)
      throw new InvalidOperationException(
          $"Item {duplicateOverrides.Key} has conflicting duplicate equipment slot overrides.");
    var overrides = (request.EquipmentOverrides ?? []).ToDictionary(o => o.ItemId, o => o.EquipSlot);
    var resolvedItems = new List<ResolvedItem>();
    foreach (var id in request.ItemIds)
    {
      var item = _items.Resolve(
              id,
              request.Race,
              request.Sex,
              overrides.TryGetValue(id, out var overrideSlot) ? overrideSlot : null);
      if (item.Error != null)
      {
        log?.Invoke($"item {id} skipped: {item.Error}");
        continue;
      }
      resolvedItems.Add(item with { Build = _build, ModelSet = "hd" });
    }
    foreach (var worn in request.ItemDisplays ?? [])
    {
      var item = _items.ResolveDisplay(worn.DisplayInfoId, worn.EquipSlot, request.Race, request.Sex);
      if (item.Error != null)
      {
        log?.Invoke($"item display {worn.DisplayInfoId} skipped: {item.Error}");
        continue;
      }
      resolvedItems.Add(item with { Build = _build, ModelSet = "hd" });
    }
    var duplicateSlot = resolvedItems
        .Where(item => item.EquipSlot != null)
        .GroupBy(item => item.EquipSlot!.Value)
        .FirstOrDefault(group => group.Count() > 1);
    if (duplicateSlot != null)
      throw new InvalidOperationException(
          $"Equipment slot {duplicateSlot.Key} is occupied by conflicting items: " +
          string.Join(", ", duplicateSlot.Select(item => $"{item.ItemId} ({item.Name})")) + ".");
    return resolvedItems;
  }
}
