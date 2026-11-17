import {
  characterDetailResponseSchema,
  characterProfileResponseSchema,
  characterSlugSchema,
  equippedItemSchema,
  type InstanceConfig,
} from "@guildhub/contracts";
import type { Hono } from "hono";
import { appError } from "../../../platform/kernel/app-error.js";
import type { AppEnv } from "../../../platform/http/app.js";
import { requestLocale } from "../../../platform/http/content-locale.js";
import { problemResponse } from "../../../platform/http/problems.js";
import type { GetCharacter } from "../application/get-character.js";
import type { GetCharacterRender } from "../application/get-character-render.js";
import type {
  GetCharacterAvatar,
  GetItemIcon,
} from "../application/get-character-media.js";
import type { GetCharacterProfile } from "../application/get-character-profile.js";
import type { GetItem } from "../application/get-item.js";
import type { CharacterView } from "../application/character-view.js";

export interface RegisterCharacterDeps {
  readonly instance: InstanceConfig;
  readonly getCharacter: GetCharacter;
  readonly getCharacterRender: GetCharacterRender;
  readonly getCharacterProfile: GetCharacterProfile;
  readonly getCharacterAvatar: GetCharacterAvatar;
  readonly getItemIcon: GetItemIcon;
  readonly getItem: GetItem;
  readonly onStaleCache: () => void;
}

export function registerCharacter(
  app: Hono<AppEnv>,
  deps: RegisterCharacterDeps,
): void {
  const guild = { slug: deps.instance.guild.slug };

  app.get("/api/characters/:slug", async (context) => {
    const parsed = characterSlugSchema.safeParse(context.req.param("slug"));
    if (!parsed.success) {
      return problemResponse(context, appError("character.not_found"));
    }
    const result = await deps.getCharacter({ guild, slug: parsed.data });
    if (!result.ok) return problemResponse(context, result.error);
    if (result.value.stale) deps.onStaleCache();
    const view = result.value;
    const etag = `"${view.fetchedAt.toISOString()}-${view.stale ? "stale" : "fresh"}"`;
    context.header("ETag", etag);
    context.header(
      "Cache-Control",
      view.stale ? "public, max-age=0, must-revalidate" : "public, max-age=60",
    );
    return context.json(
      characterDetailResponseSchema.parse(toDetail(view.data, view)),
    );
  });

  app.get("/api/characters/:slug/profile", async (context) => {
    const parsed = characterSlugSchema.safeParse(context.req.param("slug"));
    if (!parsed.success) {
      return problemResponse(context, appError("character.not_found"));
    }
    const result = await deps.getCharacterProfile({
      guild,
      slug: parsed.data,
      locale: requestLocale(context),
    });
    if (!result.ok) return problemResponse(context, result.error);
    const { profile } = result.value.data;
    context.header(
      "Cache-Control",
      result.value.stale
        ? "public, max-age=0, must-revalidate"
        : "public, max-age=120",
    );
    return context.json(
      characterProfileResponseSchema.parse({
        characterId: profile.characterId,
        slug: profile.slug,
        status: profile.status,
        ...profile.data,
        fetchedAt: result.value.fetchedAt.toISOString(),
        stale: result.value.stale,
      }),
    );
  });

  app.get("/api/characters/:slug/render", async (context) => {
    const parsed = characterSlugSchema.safeParse(context.req.param("slug"));
    if (!parsed.success) {
      return problemResponse(context, appError("character.not_found"));
    }
    const result = await deps.getCharacterRender({ guild, slug: parsed.data });
    if (!result.ok) return problemResponse(context, result.error);
    return image(result.value, "public, max-age=3600");
  });

  app.get("/api/characters/:slug/avatar", async (context) => {
    const parsed = characterSlugSchema.safeParse(context.req.param("slug"));
    if (!parsed.success) {
      return problemResponse(context, appError("character.not_found"));
    }
    const result = await deps.getCharacterAvatar({ guild, slug: parsed.data });
    if (!result.ok) return problemResponse(context, result.error);
    return image(result.value, "public, max-age=3600");
  });

  app.get("/api/items/:itemId{[0-9]+}", async (context) => {
    const result = await deps.getItem({
      guild,
      itemId: Number(context.req.param("itemId")),
      locale: requestLocale(context),
    });
    if (!result.ok) return problemResponse(context, result.error);
    context.header("Cache-Control", "public, max-age=86400");
    return context.json(equippedItemSchema.parse(result.value));
  });

  app.get("/api/icons/:iconId{[0-9]+}", async (context) => {
    const result = await deps.getItemIcon(Number(context.req.param("iconId")));
    if (!result.ok) return problemResponse(context, result.error);
    return image(result.value, "public, max-age=31536000, immutable");
  });
}

function image(
  value: { body: Uint8Array; contentType: string },
  cacheControl: string,
): Response {
  return new Response(value.body, {
    status: 200,
    headers: {
      "Content-Type": value.contentType,
      "Cache-Control": cacheControl,
    },
  });
}

function toDetail(
  view: CharacterView,
  envelope: { fetchedAt: Date; stale: boolean },
) {
  const member = view.member;
  return {
    characterId: member.characterId,
    name: member.name,
    surname: member.surname,
    level: member.level,
    rankId: member.rankId,
    classId: member.classId,
    raceId: member.raceId,
    slug: member.slug,
    published: view.published,
    pose: view.pose,
    accent: view.accent,
    lookManifest: view.lookManifest,
    renderUrl: view.renderUrl,
    model: view.model,
    fetchedAt: envelope.fetchedAt.toISOString(),
    stale: envelope.stale,
  };
}
