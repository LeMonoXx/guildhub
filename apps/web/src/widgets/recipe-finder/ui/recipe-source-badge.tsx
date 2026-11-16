import type { RecipeSource } from "@guildhub/contracts";
import type { ReactNode } from "react";
import { itemQualityColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { wowheadUrl } from "../../../shared/lib";

type LocaleContext = Pick<ReturnType<typeof useLocale>, "t" | "locale">;

const sourceViews: {
  readonly [K in RecipeSource["kind"]]: (
    source: Extract<RecipeSource, { kind: K }>,
    context: LocaleContext,
  ) => ReactNode;
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

export function RecipeSourceBadge({
  source,
}: {
  readonly source: RecipeSource;
}) {
  const { t, locale } = useLocale();
  const view = sourceViews[source.kind] as (
    source: RecipeSource,
    context: LocaleContext,
  ) => ReactNode;
  return view(source, { t, locale });
}
