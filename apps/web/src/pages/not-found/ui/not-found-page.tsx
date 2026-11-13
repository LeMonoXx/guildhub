import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { formatDocumentTitle } from "../../../shared/lib";
import { DocumentTitle } from "../../../shared/ui";

export function NotFoundPage() {
  const { t } = useLocale();
  return (
    <article className="not-found-page">
      <DocumentTitle value={formatDocumentTitle(t("notFound.title"))} />
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <Link to="/">{t("notFound.home")}</Link>
    </article>
  );
}
