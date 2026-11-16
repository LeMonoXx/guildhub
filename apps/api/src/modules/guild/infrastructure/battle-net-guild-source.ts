import type { BlizzardApiClient } from "@blizzard-api/client";
import { z } from "zod";
import {
  sendBattleNet,
  type BattleNetResource,
} from "../../../platform/blizzard/request.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { GuildSource, GuildSourceError } from "../application/ports.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import {
  assignCharacterSlug,
  uniquifySlugs,
} from "../domain/character-slug.js";
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
  created_timestamp: z.number().int().positive().optional(),
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
        return ok(uniquifySlugs(parsed.data.members.map(toMember)));
      }),
  };
}

async function send<T>(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  map: (body: unknown) => Result<T, GuildSourceError>,
): Promise<Result<T, GuildSourceError>> {
  const body = await sendBattleNet(client, resource, {
    notFound: "guild.not_found",
  });
  return body.ok ? map(body.value) : body;
}

function toProfile(body: z.infer<typeof blizzardGuildSchema>): GuildProfile {
  return {
    id: String(body.id),
    slug: body.slug,
    name: body.name,
    faction: body.faction.type,
    achievementPoints: body.achievement_points,
    memberCount: body.member_count,
    ...(body.created_timestamp === undefined
      ? {}
      : { createdAt: new Date(body.created_timestamp).toISOString() }),
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
    slug: assignCharacterSlug(
      member.character.name,
      member.character.surname,
      String(member.character.id),
    ),
  };
}
