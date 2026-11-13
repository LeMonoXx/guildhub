import de from "./locales/de.json";
import en from "./locales/en.json";
import type { Locale } from "./locale";
import type { MessageTree } from "./translate";

export const enMessages: MessageTree = en;
export const deMessages: MessageTree = de;

const catalog: Record<Locale, MessageTree> = {
  en: enMessages,
  de: deMessages,
};

export const messagesFor = (locale: Locale): MessageTree => catalog[locale];
