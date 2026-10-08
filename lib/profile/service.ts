import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { profile, type ProfileNotices } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { pruneTombstones, recordTombstone } from "@/lib/credits/tombstone";
import { deleteUserPhotos } from "@/lib/scans/photo-storage";
import { TargetsSchema } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS, allergensForDiet, type AllergenKey } from "@/lib/nutrition/personalise";

export type ProfileRow = typeof profile.$inferSelect;

/**
 * The user's profile, created with defaults on first use. Read first, so the usual case (every page
 * render calls this, Today several times) is one SELECT and never a write on a GET (review M10); the
 * insert runs only when the row is missing, and ON CONFLICT keeps a concurrent first visit safe.
 */
export async function ensureProfile(userId: string, country?: string): Promise<ProfileRow> {
  const [existing] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (existing) return existing;
  await db
    .insert(profile)
    .values({ userId, ...(country ? { country } : {}) })
    .onConflictDoNothing();
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!row) throw new Error("profile missing after ensureProfile");
  return row;
}

export const getProfile = (userId: string) => ensureProfile(userId);

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateTimezone(userId: string, tz: string) {
  if (!isValidTimezone(tz)) return;
  await db.update(profile).set({ timezone: tz, updatedAt: new Date() }).where(eq(profile.userId, userId));
}

export const ProfileUpdateSchema = z.object({
  goal: z.enum(["general", "weight_loss", "muscle", "low_sugar", "low_sodium"]).optional(),
  diet: z.enum(["none", "vegetarian", "eggetarian", "vegan", "jain"]).optional(),
  allergies: z.array(z.enum(ALLERGEN_KEYS)).max(10).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  targets: TargetsSchema.nullable().optional(),
  onboarded: z.literal(true).optional(),
});

export async function updateProfile(userId: string, raw: z.infer<typeof ProfileUpdateSchema>) {
  const { onboarded, ...rest } = ProfileUpdateSchema.parse(raw);
  // Keep stored allergies consistent with the (possibly just-changed) diet, even when
  // only one of the two is part of this update — e.g. switching to vegan server-side
  // must drop a previously saved "egg" allergy even if this call doesn't touch allergies.
  if (rest.diet !== undefined || rest.allergies !== undefined) {
    const [row] = await db.select({ diet: profile.diet, allergies: profile.allergies }).from(profile).where(eq(profile.userId, userId));
    const effectiveDiet = rest.diet ?? row?.diet ?? "none";
    const effectiveAllergies = (rest.allergies ?? row?.allergies ?? []) as AllergenKey[];
    const allowed = new Set(allergensForDiet(effectiveDiet));
    rest.allergies = effectiveAllergies.filter((a) => allowed.has(a));
  }
  await db.update(profile).set({ ...rest, ...(onboarded ? { onboardedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(profile.userId, userId));
}

export const NOTICE_KEYS = ["targetsReset"] as const satisfies readonly (keyof ProfileNotices)[];
export type NoticeKey = (typeof NOTICE_KEYS)[number];

/** Records a one-time notice as dismissed (spec §B): merges `{ [key]: true }` into profile.notices. */
export async function dismissNotice(userId: string, key: NoticeKey) {
  await db.update(profile)
    .set({ notices: sql`${profile.notices} || ${JSON.stringify({ [key]: true })}::jsonb`, updatedAt: new Date() })
    .where(eq(profile.userId, userId));
}

/**
 * Deletes the account. Scan photos first (spec §A Deletion): both R2 prefixes go before the user row
 * does, and a failure throws with the account intact, so trying again finishes the job. Pass
 * `photosDeleted` when the caller already did that step (deleteAccountAction does it before signing the
 * user out, so a storage error never happens after sign-out). After the commit a best-effort second
 * sweep catches a thumbnail an in-flight scan job put in the meantime.
 */
export async function deleteAccount(userId: string, now: Date = new Date(), opts: { photosDeleted?: boolean } = {}) {
  if (!opts.photosDeleted) await deleteUserPhotos(userId);
  await db.transaction(async (tx) => {
    // Lock order (review N4): the user's running scans first, then the profile — the same order as
    // failScanTx (conditional scan UPDATE, then refundScan's profile lock) and deleteScan. Taking the
    // profile first (as recordTombstone would) could deadlock against an AI job failing or finishing
    // at the moment the user confirms deletion.
    await tx.execute(sql`SELECT id FROM scan WHERE user_id = ${userId} AND status IN ('queued', 'processing') FOR UPDATE`);
    await tx.execute(sql`SELECT 1 FROM profile WHERE user_id = ${userId} FOR UPDATE`);
    // Keep this period's AI-scan usage and today's count (keyed by an email HMAC) so signing up again can't reset them.
    await recordTombstone(tx, userId, now);
    await tx.delete(user).where(eq(user.id, userId)); // FKs cascade: profile, sessions, accounts, scans, credit_txn, food_log, user_food_stats, custom foods, workouts (and their exercises and sets), body_weight
  });
  // Second photo sweep, after the commit and best-effort: an upload that finished between the first
  // sweep and the commit could otherwise leave objects behind (attachScanPhotos also cleans up after
  // itself when its scan is gone, but only for its own keys and only if it gets that far).
  try {
    await deleteUserPhotos(userId);
  } catch (err) {
    console.error("post-deletion photo sweep failed", err);
  }
  // Opportunistic retention sweep (review N5), after the deletion has committed: a failure here must
  // never fail or roll back the deletion itself.
  try {
    await pruneTombstones(now);
  } catch (err) {
    console.error("pruneTombstones failed", err);
  }
}
