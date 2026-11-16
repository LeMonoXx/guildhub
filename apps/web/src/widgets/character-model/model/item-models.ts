import type { ResolvedItem } from "./types";

export interface ItemDisplayModel {
  readonly fileDataId: number;
  readonly textureFileDataId?: number;
}

/** Every mesh this item can stand alone as. Armor painted on the body has none. */
export function itemDisplayModels(item: ResolvedItem): ItemDisplayModel[] {
  const seen = new Set<number>();
  const models: ItemDisplayModel[] = [];
  const add = (fileDataId: number, textureFileDataId?: number | null) => {
    if (fileDataId <= 0 || seen.has(fileDataId)) return;
    seen.add(fileDataId);
    models.push({
      fileDataId,
      ...(textureFileDataId === undefined || textureFileDataId === null
        ? {}
        : { textureFileDataId }),
    });
  };
  for (const attachment of item.attachments ?? [])
    add(attachment.modelFileDataId, attachment.textureFileDataId);
  for (const slot of item.models) {
    const texture = slot.textures[0]?.fileDataId;
    for (const model of slot.models) add(model.fileDataId, texture);
  }
  return models;
}
