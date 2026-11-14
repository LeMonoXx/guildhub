import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../platform/db/client.js";
import type { CharacterCache } from "../application/ports.js";
import type { CharacterSnapshot } from "../domain/snapshot.js";
import { characterCache } from "./schema.js";

const factsSchema = z.object({
  raceId: z.number().int().positive(),
  sex: z.union([z.literal(0), z.literal(1)]),
  classId: z.number().int().positive(),
  customizations: z.array(
    z.object({
      optionId: z.number().int().positive(),
      choiceId: z.number().int().positive(),
    }),
  ),
  itemIds: z.array(z.number().int().positive()),
  equipmentOverrides: z.array(
    z.object({
      itemId: z.number().int().positive(),
      equipSlot: z.number().int().positive(),
    }),
  ),
  renderAssetUrl: z.url().optional(),
  avatarAssetUrl: z.url().optional(),
  carries: z.array(z.enum(["shield", "two-hand"])).optional(),
});

export function makeDrizzleCharacterCache(database: Database): CharacterCache {
  return {
    latest: async (characterId) => {
      const rows = await database.db
        .select()
        .from(characterCache)
        .where(eq(characterCache.characterId, characterId))
        .limit(1);
      return parseRow(rows[0]);
    },
    latestMany: async (characterIds) => {
      if (characterIds.length === 0) return [];
      const rows = await database.db
        .select()
        .from(characterCache)
        .where(inArray(characterCache.characterId, [...characterIds]));
      return rows.flatMap((row) => {
        const parsed = parseRow(row);
        return parsed === undefined ? [] : [parsed];
      });
    },
    save: async (snapshot) => {
      await database.db
        .insert(characterCache)
        .values(toRow(snapshot))
        .onConflictDoUpdate({
          target: characterCache.characterId,
          set: toRow(snapshot),
        });
    },
  };
}

function toRow(snapshot: CharacterSnapshot) {
  return {
    characterId: snapshot.characterId,
    slug: snapshot.slug,
    name: snapshot.name,
    surname: snapshot.surname,
    status: snapshot.status,
    facts: snapshot.facts,
    fetchedAt: snapshot.fetchedAt,
  };
}

function parseRow(
  row:
    | {
        characterId: string;
        slug: string;
        name: string;
        surname: string;
        status: string;
        facts: unknown;
        fetchedAt: Date;
      }
    | undefined,
): CharacterSnapshot | undefined {
  if (row === undefined) return undefined;
  const parsed = factsSchema.safeParse(row.facts);
  if (!parsed.success) return undefined;
  return {
    characterId: row.characterId,
    slug: row.slug,
    name: row.name,
    surname: row.surname,
    status: row.status === "missing" ? "missing" : "found",
    facts: parsed.data,
    fetchedAt: row.fetchedAt,
  };
}
