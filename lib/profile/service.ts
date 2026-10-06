import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profile } from "@/lib/db/schema";

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
