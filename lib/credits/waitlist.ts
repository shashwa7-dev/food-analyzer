import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { waitlist } from "@/lib/db/schema";

/** Idempotent: inserting the same user twice keeps exactly one row. */
export async function joinWaitlist(userId: string): Promise<void> {
  await db.insert(waitlist).values({ userId }).onConflictDoNothing();
}

export async function isOnWaitlist(userId: string): Promise<boolean> {
  const [row] = await db.select({ userId: waitlist.userId }).from(waitlist).where(eq(waitlist.userId, userId));
  return row !== undefined;
}
