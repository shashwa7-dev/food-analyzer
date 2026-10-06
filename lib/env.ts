import { z } from "zod";

const nonEmpty = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1));
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z.object({
  DATABASE_URL: nonEmpty,
  BETTER_AUTH_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32)),
  BETTER_AUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url()),
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
  OFF_CONTACT_EMAIL: optional,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
