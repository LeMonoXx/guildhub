// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Portions are ported from wow.export, Copyright (c) Kruithne and Marlamin,
// MIT License. See the repository's third-party notices.

import type {
  CharacterLook,
  ItemEffect,
  ResolvedItem,
  TextureLayer,
} from "../../../types";

const SLOT_LAYER: Record<number, number> = {
  4: 10,
  7: 10,
  1: 11,
  8: 11,
  3: 13,
  30: 13,
  5: 13,
  19: 17,
  6: 18,
  9: 19,
  10: 20,
  16: 21,
  17: 22,
  15: 23,
};

export interface Attachment {
  slot: number;
  itemId: number;
  attachmentId: number;
  modelFileDataId: number;
  replaceableTextures: Record<number, number>;
  effects?: ItemEffect[];
}

export interface Dressed {
  layers: TextureLayer[];
  geosets: number[];
  replaceableTextures: Record<number, number>;
  attachments: Attachment[];
  notes: string[];
}

/** Converts the baker's resolved fixed outfit into browser drawing state. */
export function dress(
  look: Pick<
    CharacterLook,
    "sections" | "sectionLayers" | "geosets" | "options"
  >,
  items: ResolvedItem[],
): Dressed {
  const notes: string[] = [];
  const sectionRect = new Map(look.sections.map((s) => [s.sectionType, s]));
  const sectionLayer = new Map(
    look.sectionLayers.map((s) => [s.sectionType, s]),
  );
  const layers: TextureLayer[] = [];
  const show = new Set(look.geosets);
  const replaceableTextures: Record<number, number> = {};
  const attachments: Attachment[] = [];

  for (const item of items) {
    if (item.error || item.equipSlot === null) continue;
    const slot = item.equipSlot;
    for (const bodyTexture of item.bodyTextures) {
      const rect = sectionRect.get(bodyTexture.section);
      const target = sectionLayer.get(bodyTexture.section);
      const fileDataId = bodyTexture.textures[0]?.fileDataId;
      if (!rect || !target || !fileDataId) {
        notes.push(
          `item ${String(item.itemId)} section ${String(bodyTexture.section)}: missing layout or texture`,
        );
        continue;
      }
      layers.push({
        textureType: target.textureType,
        layer: (SLOT_LAYER[slot] ?? 10) * 100 + bodyTexture.section,
        blendMode: target.blendMode,
        section: rect,
        fileDataId,
        itemId: item.itemId,
        slot,
      });
    }
    for (const change of item.geosets ?? []) {
      for (const geoset of [...show])
        if (
          geoset >= change.group * 100 + 1 &&
          geoset <= change.group * 100 + 99
        )
          show.delete(geoset);
      show.add(change.geoset);
    }
    Object.assign(replaceableTextures, item.bodyReplaceableTextures);
    for (const attachment of item.attachments ?? []) {
      attachments.push({
        slot: attachment.slot,
        itemId: item.itemId,
        attachmentId: attachment.attachmentId,
        modelFileDataId: attachment.modelFileDataId,
        replaceableTextures:
          attachment.textureFileDataId === null
            ? {}
            : { 2: attachment.textureFileDataId },
        effects: item.effects,
      });
    }
  }

  layers.sort((a, b) => a.layer - b.layer);
  return {
    layers,
    geosets: [...show].sort((a, b) => a - b),
    replaceableTextures,
    attachments,
    notes,
  };
}
