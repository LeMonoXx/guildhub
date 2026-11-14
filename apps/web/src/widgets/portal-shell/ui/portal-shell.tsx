import { Link, Outlet } from "@tanstack/react-router";
import { LocaleSwitcher } from "../../../features/locale-switcher";
import { useLocale } from "../../../shared/i18n";
import { SkipLink } from "../../../shared/ui";

export function PortalShell() {
  const { t } = useLocale();
  return (
    <div className="portal-shell">
      <SkipLink href="#main">{t("nav.skip")}</SkipLink>
      <header className="portal-header">
        <nav className="portal-nav" aria-label={t("nav.primary")}>
          <Link to="/" className="portal-brand">
            GuildHub
          </Link>
          <Link to="/" className="portal-nav-link">
            {t("nav.home")}
          </Link>
          <Link to="/members" className="portal-nav-link">
            {t("nav.members")}
          </Link>
          <Link to="/professions" className="portal-nav-link">
            {t("nav.professions")}
          </Link>
        </nav>
        <LocaleSwitcher />
      </header>
      <main id="main" className="portal-main">
        <Outlet />
      </main>
      <footer className="portal-footer">
        <p>{t("footer.disclaimer")}</p>
      </footer>
    </div>
  );
}
