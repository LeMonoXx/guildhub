import { contentLocaleOf, type ContentLocale } from "@guildhub/contracts";
import type { Context } from "hono";

/** The language the site asks game texts in, `?locale=de`. */
export const requestLocale = (context: Context): ContentLocale =>
  contentLocaleOf(context.req.query("locale"));
