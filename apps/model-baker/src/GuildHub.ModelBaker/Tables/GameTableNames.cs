// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

namespace GuildHub.ModelBaker.Tables;

// Every table the app reads. Each one has a vendored definition in Definitions/.
public static class GameTableNames
{
    public const string CharComponentTextureLayouts = nameof(CharComponentTextureLayouts);
    public const string CharComponentTextureSections = nameof(CharComponentTextureSections);
    public const string ChrCustomizationChoice = nameof(ChrCustomizationChoice);
    public const string ChrCustomizationElement = nameof(ChrCustomizationElement);
    public const string ChrCustomizationGeoset = nameof(ChrCustomizationGeoset);
    public const string ChrCustomizationMaterial = nameof(ChrCustomizationMaterial);
    public const string ChrCustomizationOption = nameof(ChrCustomizationOption);
    public const string ChrCustomizationReq = nameof(ChrCustomizationReq);
    public const string ChrModel = nameof(ChrModel);
    public const string ChrModelAltVariant = nameof(ChrModelAltVariant);
    public const string ChrModelMaterial = nameof(ChrModelMaterial);
    public const string ChrModelTextureLayer = nameof(ChrModelTextureLayer);
    public const string ChrRaceXChrModel = nameof(ChrRaceXChrModel);
    public const string ChrRaces = nameof(ChrRaces);
    public const string ComponentModelFileData = nameof(ComponentModelFileData);
    public const string ComponentTextureFileData = nameof(ComponentTextureFileData);
    public const string CreatureDisplayInfo = nameof(CreatureDisplayInfo);
    public const string CreatureDisplayInfoExtra = nameof(CreatureDisplayInfoExtra);
    public const string CreatureDisplayInfoOption = nameof(CreatureDisplayInfoOption);
    public const string CreatureModelData = nameof(CreatureModelData);
    public const string HelmetGeosetData = nameof(HelmetGeosetData);
    public const string Item = nameof(Item);
    public const string ItemAppearance = nameof(ItemAppearance);
    public const string ItemDisplayInfo = nameof(ItemDisplayInfo);
    public const string ItemDisplayInfoMaterialRes = nameof(ItemDisplayInfoMaterialRes);
    public const string ItemModifiedAppearance = nameof(ItemModifiedAppearance);
    public const string ItemSparse = nameof(ItemSparse);
    public const string ItemVisuals = nameof(ItemVisuals);
    public const string ModelFileData = nameof(ModelFileData);
    public const string NPCModelItemSlotDisplayInfo = nameof(NPCModelItemSlotDisplayInfo);
    public const string TextureFileData = nameof(TextureFileData);

    public static readonly IReadOnlyList<string> All =
    [
        CharComponentTextureLayouts, CharComponentTextureSections,
        ChrCustomizationChoice, ChrCustomizationElement, ChrCustomizationGeoset, ChrCustomizationMaterial,
        ChrCustomizationOption, ChrCustomizationReq, ChrModel, ChrModelAltVariant, ChrModelMaterial,
        ChrModelTextureLayer, ChrRaceXChrModel, ChrRaces, ComponentModelFileData, ComponentTextureFileData,
        CreatureDisplayInfo, CreatureDisplayInfoExtra, CreatureDisplayInfoOption, CreatureModelData, HelmetGeosetData, Item, ItemAppearance, ItemDisplayInfo,
        ItemDisplayInfoMaterialRes, ItemModifiedAppearance, ItemSparse, ItemVisuals, ModelFileData,
        NPCModelItemSlotDisplayInfo, TextureFileData,
    ];
}
