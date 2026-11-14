import type { Locale } from "../i18n";

export type WowheadKind = "item" | "spell";

const languageSegment: Readonly<Record<Locale, string>> = { en: "", de: "/de" };

/** Wowhead's pages for WoW Forever, in the reader's language; the language follows the game version. */
export const wowheadUrl = (
  kind: WowheadKind,
  id: number,
  locale: Locale,
): string =>
  `https://www.wowhead.com/forever${languageSegment[locale]}/${kind}=${String(id)}`;
