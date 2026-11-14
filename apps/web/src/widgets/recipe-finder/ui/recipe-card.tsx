import type { RecipeResult, RecipeSource } from "@guildhub/contracts";
import {
  CharacterLink,
  ItemIcon,
  itemQualityColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber, wowheadUrl } from "../../../shared/lib";

type LocaleContext = Pick<ReturnType<typeof useLocale>, "t" | "locale">;

const sourceViews: {
  readonly [K in RecipeSource["kind"]]: (
    source: Extract<RecipeSource, { kind: K }>,
    context: LocaleContext,
  ) => React.ReactNode;
} = {
  trainer: (_source, { t }) => (
    <span className="recipe-source is-trainer">
      {t("recipes.source.trainer")}
    </span>
  ),
  "recipe-item": (source, { t, locale }) => (
    <a
      className="recipe-source is-item"
      href={wowheadUrl("item", source.item.id, locale)}
      target="_blank"
      rel="noreferrer"
      title={t("recipes.source.itemHint")}
    >
      <span style={{ color: itemQualityColorVar(source.item.quality) }}>
        {source.item.name}
      </span>
      {source.requiredSkill !== undefined && (
        <span className="recipe-source-skill">
          {t("recipes.source.skill", { skill: source.requiredSkill })}
        </span>
      )}
    </a>
  ),
};

function SourceBadge({ source }: { readonly source: RecipeSource }) {
  const { t, locale } = useLocale();
  const view = sourceViews[source.kind] as (
    source: RecipeSource,
    context: LocaleContext,
  ) => React.ReactNode;
  return view(source, { t, locale });
}

interface RecipeCardProps {
  readonly recipe: RecipeResult;
  readonly highlightStat?: string | undefined;
}

export function RecipeCard({ recipe, highlightStat }: RecipeCardProps) {
  const { t, locale } = useLocale();
  const item = recipe.craftedItem;
  const quality = item?.quality;
  return (
    <article
      className="recipe-card"
      style={
        quality
          ? { ["--item-quality" as string]: itemQualityColorVar(quality) }
          : undefined
      }
    >
      <header className="recipe-card-head">
        <ItemIcon
          iconUrl={item?.iconUrl ?? recipe.iconUrl}
          quality={quality}
          size="md"
        />
        <div>
          <h3>
            {item ? (
              <a
                href={wowheadUrl("item", item.id, locale)}
                target="_blank"
                rel="noreferrer"
                style={{ color: itemQualityColorVar(item.quality) }}
              >
                {recipe.name}
              </a>
            ) : (
              recipe.name
            )}
            {recipe.craftedQuantity > 1 && (
              <span className="recipe-quantity">
                {" "}
                ×{recipe.craftedQuantity}
              </span>
            )}
          </h3>
          <p className="recipe-meta">
            {[recipe.profession, recipe.category, item?.slot]
              .filter(Boolean)
              .join(" · ")}
            {item?.itemLevel !== undefined &&
              ` · ${t("recipes.itemLevel", { level: item.itemLevel })}`}
          </p>
        </div>
      </header>

      {item && (item.stats.length > 0 || item.effects.length > 0) && (
        <div className="recipe-effects">
          {item.stats.length > 0 && (
            <ul className="recipe-stats">
              {item.stats.map((stat) => (
                <li
                  key={stat.type}
                  className={
                    stat.type === highlightStat ? "is-highlight" : undefined
                  }
                >
                  {stat.type === "ARMOR"
                    ? `${formatNumber(stat.value, locale)} ${stat.name}`
                    : `+${formatNumber(stat.value, locale)} ${stat.name}`}
                </li>
              ))}
            </ul>
          )}
          {item.effects.map((effect) => (
            <p key={effect} className="recipe-effect">
              {effect}
            </p>
          ))}
        </div>
      )}

      {recipe.reagents.length > 0 && (
        <ul className="recipe-reagents" aria-label={t("recipes.reagents")}>
          {recipe.reagents.map((reagent) => (
            <li key={reagent.itemId}>
              <a
                href={wowheadUrl("item", reagent.itemId, locale)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="recipe-reagent-count">
                  {reagent.quantity}×
                </span>{" "}
                {reagent.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className="recipe-card-foot">
        <div className="recipe-crafters">
          <span className="recipe-label">{t("recipes.crafters")}</span>
          {recipe.crafters.length > 0 ? (
            <ul>
              {recipe.crafters.map((crafter) => (
                <li key={crafter.characterId}>
                  <CharacterLink slug={crafter.slug} classId={crafter.classId}>
                    {crafter.name}
                  </CharacterLink>
                  {crafter.skill !== undefined && (
                    <span className="recipe-crafter-skill">
                      {crafter.skill}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">{t("recipes.noCrafter")}</span>
          )}
        </div>
        <div className="recipe-origin">
          <span className="recipe-label">{t("recipes.source.label")}</span>
          <SourceBadge source={recipe.source} />
        </div>
      </footer>
    </article>
  );
}
