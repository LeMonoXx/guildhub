import {
  FEATURED_MEMBER_LIMIT,
  pickFeatured,
  presentMember,
  toPublicRosterMember,
  type RosterMember,
} from "../../guild/index.js";
import { publicAvatarUrl, publicRenderUrl } from "../domain/model.js";
import type { CharacterCache } from "./ports.js";
import { loadCharacterView } from "./get-character.js";

type LookDeps = Parameters<typeof loadCharacterView>[0];

/**
 * Takes candidates in featuring order and shows the first members whose
 * profile Battle.net publishes, so the lineup never shows an unknown outfit.
 */
export const makePresentFeaturedMembers =
  (deps: LookDeps) => async (candidates: readonly RosterMember[]) => {
    const views = [];
    for (
      let start = 0;
      start < candidates.length &&
      views.filter((view) => view.published).length < FEATURED_MEMBER_LIMIT;
      start += FEATURED_MEMBER_LIMIT
    ) {
      const batch = candidates.slice(start, start + FEATURED_MEMBER_LIMIT);
      views.push(
        ...(await Promise.all(
          batch.map((member) =>
            loadCharacterView(deps, member, { enqueue: true }),
          ),
        )),
      );
    }
    return pickFeatured(views, (view) => view.published).map((view) => ({
      ...presentMember(view.member),
      lookManifest: view.lookManifest,
      renderUrl: view.renderUrl,
      carries: view.carries,
    }));
  };

export const makePresentRosterMembers =
  (deps: { cache: CharacterCache }) =>
  async (members: readonly RosterMember[]) => {
    const snapshots = await deps.cache.latestMany(
      members.map((member) => member.characterId),
    );
    const byId = new Map(
      snapshots.map((snapshot) => [snapshot.characterId, snapshot]),
    );
    return members.map((member) => {
      const presented = toPublicRosterMember(member);
      const facts = byId.get(member.characterId)?.facts;
      return {
        ...presented,
        ...(facts?.renderAssetUrl === undefined
          ? {}
          : { renderUrl: publicRenderUrl(member.slug) }),
        ...(facts?.avatarAssetUrl === undefined
          ? {}
          : { avatarUrl: publicAvatarUrl(member.slug) }),
      };
    });
  };
