import type { Profession } from "@guildhub/contracts";
import {
  int,
  list,
  name,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { CharacterProfileData } from "../domain/profile.js";

/** The talents of the active specialization group. */
export function mapSpecializations(
  value: unknown,
): CharacterProfileData["specializations"] {
  return activeSpecializations(value).flatMap((entry) => {
    const record = rec(entry);
    const spec = rec(record.specialization);
    const id = int(spec.id);
    const label = str(record.specialization_name) ?? str(spec.name);
    if (id === undefined || !label) return [];
    return [
      {
        id,
        name: label,
        spentPoints: Math.max(0, int(record.spent_points) ?? 0),
        talents: list(record.talents).flatMap(mapTalent),
      },
    ];
  });
}

/** The specializations of the active group, or of the first when none is marked. */
export function activeSpecializations(value: unknown): readonly unknown[] {
  const groups = list(rec(value).specialization_groups);
  const active =
    groups.find((group) => rec(group).is_active === true) ?? groups[0];
  return list(rec(active).specializations);
}

function mapTalent(talent: unknown) {
  const t = rec(talent);
  const tooltip = rec(t.spell_tooltip);
  const talentName = name(t.talent) ?? name(tooltip.spell);
  if (!talentName) return [];
  return [
    {
      name: talentName,
      rank: Math.max(0, int(t.talent_rank) ?? 0),
      ...optional("description", str(tooltip.description)),
      ...optional("castTime", str(tooltip.cast_time)),
      ...optional("spellId", int(rec(tooltip.spell).id)),
    },
  ];
}

export function mapProfessions(professions: unknown): Profession[] {
  const record = rec(professions);
  return [
    ...mapProfessionList(record.primaries, "primary"),
    ...mapProfessionList(record.secondaries, "secondary"),
  ];
}

function mapProfessionList(
  value: unknown,
  kind: Profession["kind"],
): Profession[] {
  return list(value).flatMap((entry) => {
    const record = rec(entry);
    const profession = rec(record.profession);
    const id = int(profession.id);
    const label = str(profession.name);
    if (id === undefined || !label) return [];
    const tiers = list(record.tiers).map(rec);
    const best = highestTier(tiers);
    const recipes = tiers.flatMap((tier) => list(tier.known_recipes));
    return [
      {
        id,
        name: label,
        kind,
        skill: Math.max(
          0,
          int(best?.skill_points) ?? int(record.skill_points) ?? 0,
        ),
        maxSkill: Math.max(
          0,
          int(best?.max_skill_points) ?? int(record.max_skill_points) ?? 0,
        ),
        recipes: recipes.flatMap((recipe) => {
          const recipeName = name(recipe);
          return recipeName ? [recipeName] : [];
        }),
        recipeIds: [
          ...new Set(
            recipes.flatMap((recipe) => {
              const recipeId = int(rec(recipe).id);
              return recipeId === undefined ? [] : [recipeId];
            }),
          ),
        ],
      },
    ];
  });
}

function highestTier(
  tiers: readonly Record<string, unknown>[],
): Record<string, unknown> | undefined {
  return tiers.reduce<Record<string, unknown> | undefined>(
    (top, tier) =>
      top === undefined ||
      (int(tier.max_skill_points) ?? 0) > (int(top.max_skill_points) ?? 0)
        ? tier
        : top,
    undefined,
  );
}
