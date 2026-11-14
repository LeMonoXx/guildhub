import { z } from "zod";

/** The language of game texts: item, talent, recipe and achievement names. */
export const contentLocales = ["en", "de"] as const;
export const contentLocaleSchema = z.enum(contentLocales);
export type ContentLocale = z.infer<typeof contentLocaleSchema>;
export const defaultContentLocale: ContentLocale = "en";

/** `?locale=de` on any API request; anything else means the default. */
export const contentLocaleOf = (value: unknown): ContentLocale => {
  const parsed = contentLocaleSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultContentLocale;
};
