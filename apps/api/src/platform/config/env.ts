import { z } from "zod";

const optionalUrl = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined || value === "" ? undefined : value,
  )
  .pipe(z.url().optional());

const optionalString = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined || value === "" ? undefined : value,
  );

const optionalPositiveInt = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? fallback : Number(value),
    )
    .pipe(z.number().int().positive());

const schema = z.object({
  BATTLENET_API_BASE_URL: optionalUrl,
  BATTLENET_CLIENT_ID: z.string().min(1),
  BATTLENET_CLIENT_SECRET: z.string().min(1),
  BATTLENET_REDIRECT_URI: z.url(),
  DATABASE_URL: z.string().min(1),
  GUILD_CACHE_TTL_SECONDS: optionalPositiveInt(300),
  CHARACTER_CACHE_TTL_SECONDS: optionalPositiveInt(900),
  ASSET_ROOT: optionalString,
  BAKER_CLI: optionalString,
  BAKER_CACHE: optionalString,
  BAKER_REGION: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? "eu" : value)),
  MODEL_CLIENT_BUILD: optionalString,
  HISTORY_CRON: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? "0 * * * *" : value,
    ),
  HISTORY_TIME_ZONE: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? "Europe/Berlin" : value,
    ),
  INSTANCE_DIR: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SERVICE_NAME: z.string().min(1).default("guildhub-api"),
  SESSION_SECRET: z.string().min(32),
  PORT: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? 3000 : Number(value),
    )
    .pipe(z.number().int().positive()),
});

export type Env = z.infer<typeof schema>;

export function readEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const keys = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid environment: ${keys}`);
  }
  return parsed.data;
}
