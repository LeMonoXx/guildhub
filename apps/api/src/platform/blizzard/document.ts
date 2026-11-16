/** Readers for untyped Battle.net JSON: each returns undefined (or empty) for anything off-shape. */

export function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Trimmed, non-blank text. */
export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Any finite number, truncated toward zero. */
export function int(value: unknown): number | undefined {
  const n = num(value);
  return n === undefined ? undefined : Math.trunc(n);
}

/** An id: a whole number above zero. */
export function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function nonNegativeInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/** Battle.net timestamps are epoch milliseconds. */
export function isoFromMillis(value: unknown): string | undefined {
  const millis = num(value);
  if (millis === undefined || millis <= 0) return undefined;
  return new Date(millis).toISOString();
}

/** The `name` of a `{ id, name }` reference. */
export function name(value: unknown): string | undefined {
  return str(rec(value).name);
}

/** The icon file of a media document's `assets`. */
export function iconIdOf(media: unknown): number | undefined {
  const icon = list(rec(media).assets)
    .map(rec)
    .find((asset) => asset.key === "icon");
  return positiveInt(icon?.file_data_id);
}

export function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]: V });
}
