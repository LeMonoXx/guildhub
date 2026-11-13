import { z } from "zod";

const schema = z.object({
  BATTLENET_CLIENT_ID: z.string().min(1),
  BATTLENET_CLIENT_SECRET: z.string().min(1),
  BATTLENET_REDIRECT_URI: z.url(),
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
