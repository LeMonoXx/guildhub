import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../platform/db/client.js";
import type { GuildCache } from "../application/ports.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import type { GuildRef } from "../domain/guild-ref.js";
import { assignCharacterSlug } from "../domain/character-slug.js";
import { rankId, type RosterMember } from "../domain/roster-member.js";
import { guildCache } from "./schema.js";

const profileSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  faction: z.enum(["ALLIANCE", "HORDE", "NEUTRAL"]),
  achievementPoints: z.number().int(),
  memberCount: z.number().int(),
  createdAt: z.iso.datetime().optional(),
});

const memberSchema = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  level: z.number().int(),
  rankId: z.number().int(),
  classId: z.string().min(1),
  raceId: z.string().min(1),
  slug: z.string().min(1).optional(),
});

export function makeDrizzleGuildCache(database: Database): GuildCache {
  return {
    latestProfile: async (guild) => {
      const row = await loadRow(database, guild);
      if (row?.profile == null || row.profileFetchedAt == null) {
        return undefined;
      }
      const parsed = profileSchema.safeParse(row.profile);
      if (!parsed.success) return undefined;
      return {
        guild,
        fetchedAt: row.profileFetchedAt,
        payload: parsed.data,
      };
    },
    latestRoster: async (guild) => {
      const row = await loadRow(database, guild);
      if (row?.roster == null || row.rosterFetchedAt == null) {
        return undefined;
      }
      const parsed = z.array(memberSchema).safeParse(row.roster);
      if (!parsed.success) return undefined;
      return {
        guild,
        fetchedAt: row.rosterFetchedAt,
        payload: parsed.data.map((member) => ({
          characterId: member.characterId,
          name: member.name,
          surname: member.surname,
          level: member.level,
          rankId: rankId(member.rankId),
          classId: member.classId,
          raceId: member.raceId,
          slug:
            member.slug ??
            assignCharacterSlug(
              member.name,
              member.surname,
              member.characterId,
            ),
        })),
      };
    },
    saveProfile: async (snapshot) => {
      await upsert(database, snapshot.guild, {
        profile: snapshot.payload,
        profileFetchedAt: snapshot.fetchedAt,
      });
    },
    saveRoster: async (snapshot) => {
      await upsert(database, snapshot.guild, {
        roster: snapshot.payload,
        rosterFetchedAt: snapshot.fetchedAt,
      });
    },
  };
}

async function loadRow(database: Database, guild: GuildRef) {
  const rows = await database.db
    .select()
    .from(guildCache)
    .where(eq(guildCache.guildSlug, guild.slug))
    .limit(1);
  return rows[0];
}

async function upsert(
  database: Database,
  guild: GuildRef,
  values: {
    profile?: GuildProfile;
    roster?: readonly RosterMember[];
    profileFetchedAt?: Date;
    rosterFetchedAt?: Date;
  },
): Promise<void> {
  await database.db
    .insert(guildCache)
    .values({
      guildSlug: guild.slug,
      profile: values.profile,
      roster: values.roster,
      profileFetchedAt: values.profileFetchedAt,
      rosterFetchedAt: values.rosterFetchedAt,
    })
    .onConflictDoUpdate({
      target: guildCache.guildSlug,
      set: {
        ...(values.profile !== undefined
          ? {
              profile: values.profile,
              profileFetchedAt: values.profileFetchedAt,
            }
          : {}),
        ...(values.roster !== undefined
          ? {
              roster: values.roster,
              rosterFetchedAt: values.rosterFetchedAt,
            }
          : {}),
      },
    });
}
