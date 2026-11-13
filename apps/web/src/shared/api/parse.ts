export const shouldParseContracts = (): boolean =>
  import.meta.env.DEV || import.meta.env.MODE === "test";

interface Parseable<T> {
  parse(value: unknown): T;
}

export const parseContract = <T>(schema: Parseable<T>, value: unknown): T =>
  shouldParseContracts() ? schema.parse(value) : (value as T);
