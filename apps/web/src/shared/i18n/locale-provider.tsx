import { useState, type ReactNode } from "react";
import {
  applyDocumentLocale,
  resolveBrowserLocale,
  writeStoredLocale,
  type Locale,
} from "./locale";
import { LocaleContext, type LocaleContextValue } from "./locale-context";
import { messagesFor } from "./messages";
import { translate } from "./translate";

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
