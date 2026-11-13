export type MessageTree = Readonly<Record<string, string>>;

export const interpolate = (
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string =>
  template.replaceAll(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });

export const translate = (
  messages: MessageTree,
  key: string,
  values?: Readonly<Record<string, string | number>>,
): string => interpolate(messages[key] ?? key, values);
