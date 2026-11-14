import {
  guildChronicleResponseSchema,
  type InstanceConfig,
} from "@guildhub/contracts";
import type { Hono } from "hono";
import type { AppEnv } from "../../../platform/http/app.js";
import { requestLocale } from "../../../platform/http/content-locale.js";
import { problemResponse } from "../../../platform/http/problems.js";
import type { GetGuildChronicle } from "../application/get-guild-chronicle.js";

export interface RegisterChronicleDeps {
  readonly instance: InstanceConfig;
  readonly getGuildChronicle: GetGuildChronicle;
}

export function registerChronicle(
  app: Hono<AppEnv>,
  deps: RegisterChronicleDeps,
): void {
  const guild = { slug: deps.instance.guild.slug };
  app.get("/api/guild/chronicle", async (context) => {
    const result = await deps.getGuildChronicle(guild, requestLocale(context));
    if (!result.ok) return problemResponse(context, result.error);
    context.header(
      "Cache-Control",
      result.value.stale
        ? "public, max-age=0, must-revalidate"
        : "public, max-age=120",
    );
    return context.json(
      guildChronicleResponseSchema.parse({
        ...result.value.data,
        fetchedAt: result.value.fetchedAt.toISOString(),
        stale: result.value.stale,
      }),
    );
  });
}
