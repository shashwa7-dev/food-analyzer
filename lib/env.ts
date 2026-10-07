import { z } from "zod";
import { DEFAULT_MODEL_FAST, DEFAULT_MODEL_STRONG } from "@/lib/engine/models";

const nonEmpty = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1));
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const authSecret = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32));
const pepper = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional());

const flag = z.preprocess((v) => (v === "" ? undefined : v), z.enum(["true", "false", "1", "0"]).optional())
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  // Validated lazily by lib/db/client.ts on first query, so `next build` works without a database URL.
  DATABASE_URL: optional,
  BETTER_AUTH_SECRET: authSecret,
  BETTER_AUTH_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url()),
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
  OFF_CONTACT_EMAIL: optional,
  /** HMAC key for account-deletion tombstones (lib/credits/tombstone.ts); read through tombstonePepper() below. */
  CREDIT_TOMBSTONE_PEPPER: pepper,
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

// Checked when this module loads (review N5): a too-short CREDIT_TOMBSTONE_PEPPER fails at boot, not at
// the first account deletion or sign-up. Only this var: the rest of env() is validated on first use,
// so `next build` and the tests keep working without the auth/Google vars.
if (!pepper.safeParse(process.env.CREDIT_TOMBSTONE_PEPPER).success) throw new Error("Invalid environment variables: CREDIT_TOMBSTONE_PEPPER");

let pepperFallbackWarned = false;

/**
 * The key for lib/credits/tombstone.ts's email HMAC: CREDIT_TOMBSTONE_PEPPER, else BETTER_AUTH_SECRET
 * (review N5). Like proGatesEnforced, it validates just the vars it needs instead of the whole cached
 * env(), so account deletion doesn't need the Google OAuth vars (the integration tests don't set them).
 * In production the fallback warns once: one secret then serves two purposes, and rotating the auth
 * secret after a leak would silently reset every tombstone.
 */
export function tombstonePepper(raw: Record<string, string | undefined> = process.env): string {
  const own = pepper.safeParse(raw.CREDIT_TOMBSTONE_PEPPER);
  if (!own.success) throw new Error("Invalid environment variables: CREDIT_TOMBSTONE_PEPPER");
  if (own.data) return own.data;
  const fallback = authSecret.safeParse(raw.BETTER_AUTH_SECRET);
  if (!fallback.success) throw new Error("CREDIT_TOMBSTONE_PEPPER or BETTER_AUTH_SECRET must be set");
  if (raw.NODE_ENV === "production" && !pepperFallbackWarned) {
    pepperFallbackWarned = true;
    console.warn("CREDIT_TOMBSTONE_PEPPER is not set; using BETTER_AUTH_SECRET");
  }
  return fallback.data;
}
