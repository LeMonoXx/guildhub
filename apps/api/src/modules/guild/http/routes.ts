import type { InstanceConfig } from "@guildhub/contracts";
import {
  featuredMembersResponseSchema,
  guildProfileResponseSchema,
  guildRosterResponseSchema,
} from "@guildhub/contracts";
import type { Hono } from "hono";
import { problemResponse } from "../../../platform/http/problems.js";
import type { AppEnv } from "../../../platform/http/app.js";
import type { GetFeaturedMembers } from "../application/get-featured-members.js";
import type { GetGuild } from "../application/get-guild.js";
import type { GetGuildRoster } from "../application/get-guild-roster.js";
import type { GuildView } from "../application/ports.js";
import type { RosterMember } from "../domain/roster-member.js";
import { selectFeaturedMembers } from "../application/featured.js";

import {
  lineupIsSettled,
  presentMember,
  toPublicRosterMember,
  type FeaturedPresentation,
} from "../application/present-member.js";

export interface RegisterGuildDeps {
  readonly instance: InstanceConfig;
  readonly getGuild: GetGuild;
  readonly getGuildRoster: GetGuildRoster;
  readonly getFeaturedMembers: GetFeaturedMembers;
  readonly presentRosterMembers?: (
    members: readonly RosterMember[],
  ) =>
    | readonly ReturnType<typeof toPublicRosterMember>[]
    | Promise<readonly ReturnType<typeof toPublicRosterMember>[]>;
  readonly presentFeaturedMembers?: (
    members: readonly RosterMember[],
  ) =>
    readonly FeaturedPresentation[] | Promise<readonly FeaturedPresentation[]>;
  readonly onStaleCache: (kind: "profile" | "roster") => void;
}

export function registerGuild(
  app: Hono<AppEnv>,
  deps: RegisterGuildDeps,
): void {
  const guild = { slug: deps.instance.guild.slug };

  app.get("/api/guild", async (context) => {
    const result = await deps.getGuild(guild);
    if (!result.ok) return problemResponse(context, result.error);
    if (result.value.stale) deps.onStaleCache("profile");
    setCacheHeaders(context, result.value);
    return context.json(
      guildProfileResponseSchema.parse({
        ...result.value.data,
        fetchedAt: result.value.fetchedAt.toISOString(),
        stale: result.value.stale,
      }),
    );
  });

  app.get("/api/guild/roster", async (context) => {
    const result = await deps.getGuildRoster(guild);
    if (!result.ok) return problemResponse(context, result.error);
    if (result.value.stale) deps.onStaleCache("roster");
    setCacheHeaders(context, result.value);
    const members = await Promise.resolve(
      deps.presentRosterMembers?.(result.value.data) ??
        result.value.data.map(toPublicRosterMember),
    );
    return context.json(
      guildRosterResponseSchema.parse({
        members,
        fetchedAt: result.value.fetchedAt.toISOString(),
        stale: result.value.stale,
      }),
    );
  });

  app.get("/api/guild/featured", async (context) => {
    const result = await deps.getFeaturedMembers(guild);
    if (!result.ok) return problemResponse(context, result.error);
    if (result.value.stale) deps.onStaleCache("roster");
    setCacheHeaders(context, result.value);
    const members: readonly FeaturedPresentation[] = await Promise.resolve(
      deps.presentFeaturedMembers?.(result.value.data) ??
        selectFeaturedMembers(result.value.data).map(presentMember),
    );
    if (!lineupIsSettled(members)) {
      context.header("ETag", undefined);
      context.header("Cache-Control", "no-store");
    }
    return context.json(
      featuredMembersResponseSchema.parse({
        members,
        fetchedAt: result.value.fetchedAt.toISOString(),
        stale: result.value.stale,
      }),
    );
  });
}

function setCacheHeaders(
  context: { header: (name: string, value: string) => void },
  view: GuildView<unknown>,
): void {
  const etag = `"${view.fetchedAt.toISOString()}-${view.stale ? "stale" : "fresh"}"`;
  context.header("ETag", etag);
  context.header(
    "Cache-Control",
    view.stale ? "public, max-age=0, must-revalidate" : "public, max-age=60",
  );
}
