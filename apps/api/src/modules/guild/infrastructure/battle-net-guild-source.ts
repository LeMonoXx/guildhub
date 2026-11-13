import type { BlizzardApiClient } from "@blizzard-api/client";
import { z } from "zod";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { GuildSource, GuildSourceError } from "../application/ports.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import { rankId, type RosterMember } from "../domain/roster-member.js";
import { guildEndpoint, guildRosterEndpoint } from "./wow-forever-guild.js";

const factionSchema = z.object({
  type: z.enum(["ALLIANCE", "HORDE", "NEUTRAL"]),
});

const blizzardGuildSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  slug: z.string().min(1),
  faction: factionSchema,
  achievement_points: z.number(),
  member_count: z.number().int(),
});

const blizzardRosterSchema = z.object({
  members: z.array(
    z.object({
      rank: z.number().int().nonnegative(),
      character: z.object({
        id: z.number().int(),
        name: z.string().min(1),
        surname: z.string().min(1),
        level: z.number().int(),
        playable_class: z.object({ id: z.number().int() }),
        playable_race: z.object({ id: z.number().int() }),
      }),
    }),
  ),
});

export function makeBattleNetGuildSource(
  client: BlizzardApiClient,
): GuildSource {
  return {
    fetchProfile: (guild) =>
      send(client, guildEndpoint(guild.slug), (body) => {
        const parsed = blizzardGuildSchema.safeParse(body);
        if (!parsed.success) {
          return err(appError("upstream.unavailable"));
        }
        return ok(toProfile(parsed.data));
      }),
    fetchRoster: (guild) =>
      send(client, guildRosterEndpoint(guild.slug), (body) => {
        const parsed = blizzardRosterSchema.safeParse(body);
        if (!parsed.success) {
          return err(appError("upstream.unavailable"));
        }
        return ok(parsed.data.members.map(toMember));
      }),
  };
}

async function send<T>(
  client: BlizzardApiClient,
  resource: Parameters<BlizzardApiClient["sendRequest"]>[0],
  map: (body: unknown) => Result<T, GuildSourceError>,
): Promise<Result<T, GuildSourceError>> {
  try {
    await ensureToken(client);
    const body = await client.sendRequest(resource);
    if (body === undefined) return err(appError("upstream.unavailable"));
    return map(body);
  } catch (error) {
    return err(mapUpstreamError(error));
  }
}

async function ensureToken(client: BlizzardApiClient): Promise<void> {
  if (client.defaults.token !== undefined) return;
  await client.refreshAccessToken();
}

function mapUpstreamError(error: unknown): GuildSourceError {
  const status = httpStatus(error);
  if (status === 404) return appError("guild.not_found");
  if (status === 429) {
    return appError("upstream.unavailable", {
      retryAfterSeconds: retryAfterSeconds(error) ?? 1,
    });
  }
  return appError("upstream.unavailable");
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function retryAfterSeconds(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: Response }).response;
  const header = response?.headers.get("Retry-After");
  if (header === null || header === undefined) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function toProfile(body: z.infer<typeof blizzardGuildSchema>): GuildProfile {
  return {
    id: String(body.id),
    slug: body.slug,
    name: body.name,
    faction: body.faction.type,
    achievementPoints: body.achievement_points,
    memberCount: body.member_count,
  };
}

function toMember(
  member: z.infer<typeof blizzardRosterSchema>["members"][number],
): RosterMember {
  return {
    characterId: String(member.character.id),
    name: member.character.name,
    surname: member.character.surname,
    level: member.character.level,
    rankId: rankId(member.rank),
    classId: String(member.character.playable_class.id),
    raceId: String(member.character.playable_race.id),
  };
}
