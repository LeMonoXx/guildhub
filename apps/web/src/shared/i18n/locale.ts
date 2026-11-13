export const locales = ["en", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeStorageKey = "guildhub.locale";

export const isLocale = (value: string | null | undefined): value is Locale =>
  value === "en" || value === "de";

export const localeFromNavigator = (language: string): Locale =>
  language.toLowerCase().startsWith("de") ? "de" : defaultLocale;

export const readStoredLocale = (
  storage: Pick<Storage, "getItem">,
): Locale | undefined => {
  try {
    const value = storage.getItem(localeStorageKey);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const writeStoredLocale = (
  locale: Locale,
  storage: Pick<Storage, "setItem">,
): void => {
  try {
    storage.setItem(localeStorageKey, locale);
  } catch {
    // Private mode can reject storage writes; the in-memory locale still applies.
  }
};

export const applyDocumentLocale = (
  locale: Locale,
  documentRef: {
    readonly documentElement: {
      setAttribute(name: string, value: string): void;
    };
  },
): void => {
  documentRef.documentElement.setAttribute("lang", locale);
};

export const resolveBrowserLocale = (): Locale => {
  try {
    return (
      readStoredLocale(globalThis.localStorage) ??
      localeFromNavigator(globalThis.navigator.language)
    );
  } catch {
    return defaultLocale;
  }
};
