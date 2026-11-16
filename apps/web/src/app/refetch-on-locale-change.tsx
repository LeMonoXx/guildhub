import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocale } from "../shared/i18n";

/** Game texts are fetched in the page's language, so a switch refetches them. */
export function RefetchOnLocaleChange() {
  const { locale } = useLocale();
  const client = useQueryClient();
  const previous = useRef(locale);
  useEffect(() => {
    if (previous.current === locale) return;
    previous.current = locale;
    void client.invalidateQueries();
  }, [client, locale]);
  return null;
}
