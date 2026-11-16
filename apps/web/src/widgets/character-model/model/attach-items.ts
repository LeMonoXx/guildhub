// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Attachment placement includes logic ported from wow.export,
// Copyright (c) Kruithne and Marlamin, MIT License.

import type * as THREE from "three";
import { meshes, type AssemblyContext } from "./assembly-context";
import type { Dressed } from "./dress";
import { mountModel, type MountedModel } from "./mount-model";

type Attachment = Dressed["attachments"][number];
type ModelUrl = (fileDataId: number, extension: "glb" | "json") => string;

interface AttachContext extends AssemblyContext {
  readonly modelUrl: ModelUrl;
  readonly timeScale: number;
}

const attachmentNode = (id: number) => `attachment_${String(id)}`;

function neverCull(root: THREE.Object3D): void {
  for (const mesh of meshes(root)) mesh.frustumCulled = false;
}

async function loadAndMount(
  fileDataId: number,
  replacements: Record<number, number>,
  namespace: string,
  context: AttachContext,
): Promise<{ scene: THREE.Object3D; mounted: MountedModel }> {
  const model = await context.assets.model(
    context.modelUrl(fileDataId, "glb"),
    context.modelUrl(fileDataId, "json"),
  );
  const mounted = await mountModel(model, replacements, context, namespace, {
    timeScale: context.timeScale,
  });
  neverCull(model.scene);
  return { scene: model.scene, mounted };
}

async function attachEffects(
  attachment: Attachment,
  item: MountedModel,
  itemName: string,
  context: AttachContext,
): Promise<void> {
  for (const [index, effect] of (attachment.effects ?? []).entries()) {
    const point = item.resolveNode(attachmentNode(effect.attachmentId));
    if (!point) continue;
    try {
      const { scene } = await loadAndMount(
        effect.modelFileDataId,
        {},
        `${itemName}_effect_${String(index)}`,
        context,
      );
      point.add(scene);
    } catch {
      context.notices.push(
        `item ${String(attachment.itemId)} effect model ${String(effect.modelFileDataId)} is unavailable`,
      );
    }
  }
}

async function attachItem(
  body: THREE.Object3D,
  attachment: Attachment,
  index: number,
  context: AttachContext,
): Promise<void> {
  const point = body.getObjectByName(attachmentNode(attachment.attachmentId));
  if (!point) {
    context.notices.push(
      `body has no attachment ${String(attachment.attachmentId)}`,
    );
    return;
  }
  try {
    const itemName = `item_${String(attachment.itemId)}_${String(attachment.modelFileDataId)}_${String(index)}`;
    const { scene, mounted } = await loadAndMount(
      attachment.modelFileDataId,
      attachment.replaceableTextures,
      itemName,
      context,
    );
    await attachEffects(attachment, mounted, itemName, context);
    point.add(scene);
  } catch {
    context.notices.push(
      `item model ${String(attachment.modelFileDataId)} is unavailable`,
    );
  }
}

/** Hangs every dressed item, and its effects, on the body's attachment points. */
export async function attachItems(
  body: THREE.Object3D,
  attachments: Dressed["attachments"],
  context: AttachContext,
): Promise<void> {
  for (const [index, attachment] of attachments.entries())
    await attachItem(body, attachment, index, context);
}
