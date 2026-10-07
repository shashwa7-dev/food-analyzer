import { z } from "zod";
import { DEFAULT_MODEL_FAST, DEFAULT_MODEL_STRONG } from "@/lib/engine/models";

const nonEmpty = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1));
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const flag = z.preprocess((v) => (v === "" ? undefined : v), z.enum(["true", "false", "1", "0"]).optional())
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  // Validated lazily by lib/db/client.ts on first query, so `next build` works without a database URL.
  DATABASE_URL: optional,
  BETTER_AUTH_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32)),
  BETTER_AUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url()),
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
  OFF_CONTACT_EMAIL: optional,
  /** Read directly by lib/credits/tombstone.ts (falls back to BETTER_AUTH_SECRET); listed here for validation. */
  CREDIT_TOMBSTONE_PEPPER: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  GOOGLE_GENERATIVE_AI_API_KEY: optional,
  MODEL_FAST: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).default(DEFAULT_MODEL_FAST)),
  MODEL_STRONG: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).default(DEFAULT_MODEL_STRONG)),
  DAILY_AI_SCAN_CAP: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).default(300)),
  /** Launch switch for the Pro-only features (lib/credits/plans.ts). Off until Pro launches. */
  PRO_GATES_ENFORCED: flag,
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

/**
 * PRO_GATES_ENFORCED, read fresh on every call (not through the cached env()), so flipping it needs
 * no restart in tests and an invalid value fails loudly. Off unless set to "true" or "1".
 */
export function proGatesEnforced(raw: Record<string, string | undefined> = process.env): boolean {
  const r = flag.safeParse(raw.PRO_GATES_ENFORCED);
  if (!r.success) throw new Error("Invalid environment variables: PRO_GATES_ENFORCED");
  return r.data;
}
