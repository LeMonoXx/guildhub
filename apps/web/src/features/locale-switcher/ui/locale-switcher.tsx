import { locales, useLocale } from "../../../shared/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="locale-switcher">
      <label htmlFor="locale-switcher">{t("locale.label")}</label>
      <select
        id="locale-switcher"
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "en" || next === "de") setLocale(next);
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {t(`locale.${code}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
