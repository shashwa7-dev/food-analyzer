import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { profile } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { TargetsSchema } from "@/lib/nutrition/targets";
import { ALLERGEN_KEYS } from "@/lib/nutrition/personalise";

export type ProfileRow = typeof profile.$inferSelect;

export async function ensureProfile(userId: string, country?: string): Promise<ProfileRow> {
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
  await db.update(profile).set({ ...rest, ...(onboarded ? { onboardedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(profile.userId, userId));
}

export async function deleteAccount(userId: string) {
  // M2 adds: delete R2 objects under u/{userId}/ before this.
  await db.delete(user).where(eq(user.id, userId)); // FKs cascade: profile, sessions, accounts, food_log, user_food_stats, custom foods
}
