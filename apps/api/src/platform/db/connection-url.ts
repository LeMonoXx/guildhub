export function toPostgresUrl(value: string): string {
  if (value.startsWith("postgres://") || value.startsWith("postgresql://")) {
    return value;
  }

  const fields = parseKeyValueConnectionString(value);
  const host = fields.Host ?? fields.Server;
  const database = fields.Database;
  const username = fields.Username ?? fields.User;
  const password = fields.Password;
  if (
    host === undefined ||
    database === undefined ||
    username === undefined ||
    password === undefined
  ) {
    return value;
  }

  const port = fields.Port ?? "5432";
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  const db = encodeURIComponent(database);
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

function parseKeyValueConnectionString(value: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const fieldValue = part.slice(separator + 1);
    if (key === "") continue;
    fields[key] = fieldValue;
  }
  return fields;
}
