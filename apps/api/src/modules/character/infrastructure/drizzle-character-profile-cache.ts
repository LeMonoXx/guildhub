import { characterProfileSchema } from "@guildhub/contracts";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../platform/db/client.js";
import type { CharacterProfileCache } from "../application/ports.js";
import type { CharacterProfileSnapshot } from "../domain/profile.js";
import { characterProfileCache } from "./schema.js";

export function makeDrizzleCharacterProfileCache(
  database: Database,
): CharacterProfileCache {
  return {
    latestMany: async (characterIds, locale) => {
      if (characterIds.length === 0) return [];
      const rows = await database.db
        .select()
        .from(characterProfileCache)
        .where(
          and(
            inArray(characterProfileCache.characterId, [...characterIds]),
            eq(characterProfileCache.locale, locale),
          ),
        );
      return rows.flatMap((row) => {
        const parsed = characterProfileSchema.safeParse(row.profile);
        if (!parsed.success) return [];
        const { characterId, slug, status, ...data } = parsed.data;
        const snapshot: CharacterProfileSnapshot = {
          characterId,
          slug,
          status,
          data,
          fetchedAt: row.fetchedAt,
        };
        return [snapshot];
      });
    },
    save: async (snapshot, locale) => {
      const row = {
        characterId: snapshot.characterId,
        locale,
        slug: snapshot.slug,
        profile: {
          characterId: snapshot.characterId,
          slug: snapshot.slug,
          status: snapshot.status,
          ...snapshot.data,
        },
        fetchedAt: snapshot.fetchedAt,
      };
      await database.db
        .insert(characterProfileCache)
        .values(row)
        .onConflictDoUpdate({
          target: [
            characterProfileCache.characterId,
            characterProfileCache.locale,
          ],
          set: row,
        });
    },
  };
}
