import { createContext, useContext, useState, type ReactNode } from "react";
import {
  applyDocumentLocale,
  resolveBrowserLocale,
  writeStoredLocale,
  type Locale,
} from "./locale";
import { messagesFor } from "./messages";
import { translate } from "./translate";

interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: (
    key: string,
    values?: Readonly<Record<string, string | number>>,
  ) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const resolved = resolveBrowserLocale();
    applyDocumentLocale(resolved, globalThis.document);
    return resolved;
  });

  const value: LocaleContextValue = {
    locale,
    setLocale(next) {
      writeStoredLocale(next, globalThis.localStorage);
      applyDocumentLocale(next, globalThis.document);
      setLocaleState(next);
    },
    t: (key, values) => translate(messagesFor(locale), key, values),
  };

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale requires LocaleProvider");
  return context;
}
