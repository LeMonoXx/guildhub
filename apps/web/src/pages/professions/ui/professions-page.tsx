import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { guildQueries } from "../../../entities/guild";
import { parseRecipeFilters } from "../../../entities/recipe";
import { useLocale } from "../../../shared/i18n";
import { asRecord, formatDocumentTitle } from "../../../shared/lib";
import { DocumentTitle } from "../../../shared/ui";
import { RecipeFinder } from "../../../widgets/recipe-finder";

export function ProfessionsPage() {
  const { t } = useLocale();
  const filters = parseRecipeFilters(asRecord(useSearch({ strict: false })));
  const navigate = useNavigate({ from: "/professions" });
  const profile = useQuery(guildQueries.profile());

  return (
    <article className="professions-page">
      <DocumentTitle
        value={formatDocumentTitle(t("recipes.title"), profile.data?.name)}
      />
      <header>
        <h1>{t("recipes.title")}</h1>
        <p>{t("recipes.lead")}</p>
      </header>
      <RecipeFinder
        filters={filters}
        onChange={(next) => {
          void navigate({ search: next, replace: true });
        }}
      />
    </article>
  );
}
