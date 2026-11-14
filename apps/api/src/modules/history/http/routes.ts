import {
  characterHistoryResponseSchema,
  characterSlugSchema,
  guildHistoryResponseSchema,
  type InstanceConfig,
} from "@guildhub/contracts";
import type { Hono } from "hono";
import type { AppEnv } from "../../../platform/http/app.js";
import { requestLocale } from "../../../platform/http/content-locale.js";
import { problemResponse } from "../../../platform/http/problems.js";
import { appError } from "../../../platform/kernel/app-error.js";
import type {
  GetCharacterHistory,
  GetGuildHistory,
} from "../application/get-history.js";

export interface RegisterHistoryDeps {
  readonly instance: InstanceConfig;
  readonly getGuildHistory: GetGuildHistory;
  readonly getCharacterHistory: GetCharacterHistory;
}

const CACHE = "public, max-age=600";

export function registerHistory(
  app: Hono<AppEnv>,
  deps: RegisterHistoryDeps,
): void {
  const guild = { slug: deps.instance.guild.slug };
  app.get("/api/guild/history", async (context) => {
    const history = guildHistoryResponseSchema.parse(
      await deps.getGuildHistory(guild, requestLocale(context)),
    );
    context.header("Cache-Control", CACHE);
    return context.json(history);
  });
  app.get("/api/characters/:slug/history", async (context) => {
    const slug = characterSlugSchema.safeParse(context.req.param("slug"));
    if (!slug.success)
      return problemResponse(context, appError("character.not_found"));
    const history = characterHistoryResponseSchema.parse(
      await deps.getCharacterHistory({
        guild,
        slug: slug.data,
        locale: requestLocale(context),
      }),
    );
    context.header("Cache-Control", CACHE);
    return context.json(history);
  });
}
