import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  recipeQueries,
  RECIPES_PER_PAGE,
  toRecipeSearch,
  withFilter,
  type RecipeFilters,
} from "../../../entities/recipe";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { StatusBlock } from "../../../shared/ui";
import { useDebounced } from "../model/use-debounced";
import { RecipeCard } from "./recipe-card";

interface RecipeFinderProps {
  readonly filters: RecipeFilters;
  readonly onChange: (filters: RecipeFilters) => void;
}

export function RecipeFinder({ filters, onChange }: RecipeFinderProps) {
  const { t, locale } = useLocale();
  const typed = useDebounced(filters.q, 250);
  const query = useQuery({
    ...recipeQueries.search({ ...toRecipeSearch(filters), q: typed }),
    placeholderData: keepPreviousData,
  });

  if (query.isError) {
    return <StatusBlock tone="error">{t("status.error")}</StatusBlock>;
  }
  const data = query.data;
  if (data && !data.catalogReady) {
    return <StatusBlock>{t("recipes.building")}</StatusBlock>;
  }

  const page = filters.page ?? 1;
  const pages = data
    ? Math.max(1, Math.ceil(data.total / RECIPES_PER_PAGE))
    : 1;

  return (
    <div className="recipe-finder" aria-busy={query.isFetching}>
      <div className="recipe-search">
        <input
          type="search"
          className="recipe-search-input"
          value={filters.q ?? ""}
          onChange={(event) => {
            onChange(
              withFilter(filters, { q: event.target.value || undefined }),
            );
          }}
          placeholder={t("recipes.placeholder")}
          aria-label={t("recipes.placeholder")}
          autoFocus
        />
        <select
          className="recipe-stat-select"
          value={filters.stat ?? ""}
          onChange={(event) => {
            onChange(
              withFilter(filters, { stat: event.target.value || undefined }),
            );
          }}
          aria-label={t("recipes.stat")}
        >
          <option value="">{t("recipes.anyStat")}</option>
          {data?.stats.map((stat) => (
            <option key={stat.type} value={stat.type}>
              {stat.name}
            </option>
          ))}
        </select>
        <label className="recipe-known-toggle">
          <input
            type="checkbox"
            checked={filters.known === true}
            onChange={(event) => {
              onChange(
                withFilter(filters, {
                  known: event.target.checked || undefined,
                }),
              );
            }}
          />
          {t("recipes.knownOnly")}
        </label>
      </div>

      <div
        className="recipe-professions"
        role="group"
        aria-label={t("recipes.professions")}
      >
        <button
          type="button"
          className="chip"
          aria-pressed={filters.profession === undefined}
          onClick={() => {
            onChange(withFilter(filters, { profession: undefined }));
          }}
        >
          {t("recipes.allProfessions")}
        </button>
        {data?.professions.map((profession) => (
          <button
            key={profession.id}
            type="button"
            className="chip"
            aria-pressed={filters.profession === profession.id}
            onClick={() => {
              onChange(
                withFilter(filters, {
                  profession:
                    filters.profession === profession.id
                      ? undefined
                      : profession.id,
                }),
              );
            }}
          >
            {profession.name}
            <span className="chip-count">
              {formatNumber(profession.recipes, locale)}
            </span>
          </button>
        ))}
      </div>

      {data ? (
        <>
          <p className="recipe-total" role="status">
            {t("recipes.total", { count: data.total })}
          </p>
          {data.recipes.length === 0 ? (
            <StatusBlock>{t("recipes.empty")}</StatusBlock>
          ) : (
            <div className="recipe-grid">
              {data.recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  highlightStat={filters.stat}
                />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="recipe-pages" aria-label={t("recipes.pages")}>
              <button
                type="button"
                className="chip"
                disabled={page <= 1}
                onClick={() => {
                  onChange({
                    ...filters,
                    page: page - 1 > 1 ? page - 1 : undefined,
                  });
                }}
              >
                {t("recipes.previous")}
              </button>
              <span>{t("recipes.page", { page, pages })}</span>
              <button
                type="button"
                className="chip"
                disabled={page >= pages}
                onClick={() => {
                  onChange({ ...filters, page: page + 1 });
                }}
              >
                {t("recipes.next")}
              </button>
            </nav>
          )}
        </>
      ) : (
        <StatusBlock>{t("status.loading")}</StatusBlock>
      )}
    </div>
  );
}
