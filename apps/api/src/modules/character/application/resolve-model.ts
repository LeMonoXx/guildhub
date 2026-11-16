import { FIXED_LOOK_MANIFEST } from "@guildhub/contracts";
import type { LookBakeDocument, LookDescription } from "../domain/look.js";
import { toLookBakeDocument } from "../domain/look.js";
import {
  publicManifestUrl,
  publicRenderUrl,
  type CharacterModel,
  type ModelBake,
} from "../domain/model.js";
import type { ModelAssetStore, ModelBuildQueue } from "./ports.js";
import { lookHash } from "./look-hash.js";

export async function resolveCharacterModel(input: {
  slug: string;
  look: LookDescription;
  assets: ModelAssetStore;
  queue: ModelBuildQueue;
  enqueue: boolean;
  hasRender: boolean;
  /** Unpublished characters have no real look, so nothing is baked for them. */
  published?: boolean;
}): Promise<{
  model: CharacterModel;
  bake: LookBakeDocument;
  lookManifest: string;
}> {
  const hash = lookHash(input.look);
  const bake = toLookBakeDocument(hash, input.look);
  if (input.published === false) {
    return {
      bake,
      lookManifest: FIXED_LOOK_MANIFEST,
      model: {
        status: "unavailable",
        lookHash: hash,
        clientBuild: input.look.clientBuild,
      },
    };
  }
  await input.assets.writeLookRequest(bake);
  const ready = await input.assets.hasLook(hash);
  if (!ready && input.enqueue) {
    await input.queue.enqueueLook(bake);
  }
  const renderUrl = input.hasRender ? publicRenderUrl(input.slug) : undefined;
  if (ready) {
    const manifestUrl = publicManifestUrl(hash);
    return {
      bake,
      lookManifest: manifestUrl,
      model: {
        status: "ready",
        lookHash: hash,
        clientBuild: input.look.clientBuild,
        manifestUrl,
        renderUrl,
      },
    };
  }
  const state = await bakeState(input, hash);
  return {
    bake,
    lookManifest: FIXED_LOOK_MANIFEST,
    model: {
      status: "pending",
      lookHash: hash,
      clientBuild: input.look.clientBuild,
      renderUrl,
      ...(state === undefined ? {} : { bake: state }),
    },
  };
}

async function bakeState(
  input: { assets: ModelAssetStore; queue: ModelBuildQueue },
  hash: string,
): Promise<ModelBake | undefined> {
  const progress = await input.assets.bakeProgress(hash);
  if (progress !== undefined)
    return { state: progress.stage, fraction: progress.fraction };
  const position = (await input.queue.queuedLooks()).indexOf(hash) + 1;
  return position > 0 ? { state: "queued", position } : undefined;
}
