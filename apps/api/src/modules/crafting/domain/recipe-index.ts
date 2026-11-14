import type { Recipe, RecipeCrafter, RecipeResult } from "@guildhub/contracts";

export const RECIPE_PAGE_SIZE = 40;

export interface RecipeQuery {
  readonly text?: string | undefined;
  readonly professionId?: number | undefined;
  readonly stat?: string | undefined;
  /** Only recipes somebody in the guild can craft. */
  readonly knownOnly?: boolean | undefined;
  readonly offset: number;
}

/** What the index needs to know about one member to find their recipes. */
export interface CrafterProfile {
  readonly crafter: Omit<RecipeCrafter, "skill">;
  readonly professions: readonly {
    readonly id: number;
    readonly skill: number;
    readonly recipeIds?: readonly number[] | undefined;
    readonly recipes: readonly string[];
  }[];
}

export interface RecipePage {
  readonly recipes: RecipeResult[];
  readonly total: number;
}

export type CraftersByRecipe = ReadonlyMap<number, readonly RecipeCrafter[]>;

/** Lower case without accents, so "Kür" finds "kur" and "Elixir" finds "elixir". */
export const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const words = (text: string | undefined): string[] =>
  normalize(text ?? "")
    .split(/\s+/)
    .filter((word) => word.length > 0);

const haystackOf = (recipe: Recipe): string =>
  normalize(
    [
      recipe.name,
      recipe.profession,
      recipe.category,
      recipe.craftedItem?.name,
      ...(recipe.craftedItem?.effects ?? []),
      ...(recipe.craftedItem?.stats.map((stat) => stat.name) ?? []),
      ...recipe.reagents.map((reagent) => reagent.name),
    ]
      .filter((part) => part !== undefined)
      .join(" "),
  );

const statValue = (recipe: Recipe, stat: string | undefined): number =>
  recipe.craftedItem?.stats.find((entry) => entry.type === stat)?.value ?? 0;

type Comparator = (left: RecipeResult, right: RecipeResult) => number;

/**
 * The catalog held in memory for searching. Results the guild can craft come
 * first; a stat filter ranks by that stat; the rest goes by name.
 */
export class RecipeIndex {
  private readonly haystacks: ReadonlyMap<number, string>;
  private readonly idsByName: ReadonlyMap<string, number[]>;

  constructor(readonly recipes: readonly Recipe[]) {
    this.haystacks = new Map(
      recipes.map((recipe) => [recipe.id, haystackOf(recipe)]),
    );
    const byName = new Map<string, number[]>();
    for (const recipe of recipes) {
      const key = normalize(recipe.name);
      byName.set(key, [...(byName.get(key) ?? []), recipe.id]);
    }
    this.idsByName = byName;
  }

  search(query: RecipeQuery, crafters: CraftersByRecipe): RecipePage {
    const needles = words(query.text);
    const matching = this.recipes
      .filter(
        (recipe) =>
          query.professionId === undefined ||
          recipe.professionId === query.professionId,
      )
      .filter(
        (recipe) =>
          query.stat === undefined || statValue(recipe, query.stat) > 0,
      )
      .filter((recipe) => {
        const haystack = this.haystacks.get(recipe.id) ?? "";
        return needles.every((needle) => haystack.includes(needle));
      })
      .map((recipe): RecipeResult => ({
        ...recipe,
        crafters: [...(crafters.get(recipe.id) ?? [])],
      }))
      .filter((recipe) => !query.knownOnly || recipe.crafters.length > 0);
    const order: readonly Comparator[] = [
      (left, right) =>
        Number(right.crafters.length > 0) - Number(left.crafters.length > 0),
      (left, right) =>
        statValue(right, query.stat) - statValue(left, query.stat),
      (left, right) => left.name.localeCompare(right.name),
    ];
    const sorted = matching.sort((left, right) =>
      order.reduce((result, compare) => result || compare(left, right), 0),
    );
    return {
      recipes: sorted.slice(query.offset, query.offset + RECIPE_PAGE_SIZE),
      total: sorted.length,
    };
  }

  /**
   * Who knows which recipe, best skill first. Profiles fetched before recipe
   * ids were kept fall back to matching recipe names.
   */
  craftersOf(members: readonly CrafterProfile[]): CraftersByRecipe {
    const result = new Map<number, RecipeCrafter[]>();
    for (const member of members) {
      for (const profession of member.professions) {
        const ids =
          profession.recipeIds ??
          profession.recipes.flatMap(
            (name) => this.idsByName.get(normalize(name)) ?? [],
          );
        for (const id of new Set(ids)) {
          result.set(id, [
            ...(result.get(id) ?? []),
            { ...member.crafter, skill: profession.skill },
          ]);
        }
      }
    }
    for (const list of result.values())
      list.sort((left, right) => (right.skill ?? 0) - (left.skill ?? 0));
    return result;
  }

  professions(): { id: number; name: string; recipes: number }[] {
    const counts = new Map<
      number,
      { id: number; name: string; recipes: number }
    >();
    for (const recipe of this.recipes) {
      const entry = counts.get(recipe.professionId) ?? {
        id: recipe.professionId,
        name: recipe.profession,
        recipes: 0,
      };
      counts.set(recipe.professionId, { ...entry, recipes: entry.recipes + 1 });
    }
    return [...counts.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  stats(): { type: string; name: string }[] {
    const stats = new Map<string, string>();
    for (const recipe of this.recipes)
      for (const stat of recipe.craftedItem?.stats ?? [])
        stats.set(stat.type, stat.name);
    return [...stats]
      .map(([type, name]) => ({ type, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
