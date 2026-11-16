export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

export const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** A number from a URL search value, which arrives either parsed or as text. */
export const searchNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value === "") return undefined;
  return Number(value);
};
