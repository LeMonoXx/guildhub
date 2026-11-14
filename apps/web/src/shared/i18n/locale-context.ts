import { createContext, useContext } from "react";
import type { Locale } from "./locale";

export interface LocaleContextValue {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: (
    key: string,
    values?: Readonly<Record<string, string | number>>,
  ) => string;
}

// Kept apart from the provider and the messages so a message edit hot-reloads
// the provider without minting a second context.
export const LocaleContext = createContext<LocaleContextValue | undefined>(
  undefined,
);

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale requires LocaleProvider");
  return context;
}
