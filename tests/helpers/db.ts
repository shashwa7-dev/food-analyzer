import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";

export const testDb = () => db;

export async function resetDb() {
  await db.execute(sql`TRUNCATE food_log, user_food_stats, credit_txn, credit_tombstone, scan, waitlist, food, profile, "session", "account", "verification", "user" RESTART IDENTITY CASCADE`);
}

export async function createUser(id = `u_${Math.random().toString(36).slice(2, 10)}`) {
  await db.insert(user).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(profile).values({ userId: id });
  return id;
}

/**
 * Resolves once another session is waiting on a lock while running a query that starts with
 * `queryPrefix` (case-insensitive); throws after `timeoutMs` (under vitest's 5 s test timeout, so this error and the caller's finally win). For deterministic lock-race tests.
 */
export async function waitUntilBlocked(queryPrefix: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await db.execute(sql`SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE ${`${queryPrefix}%`}`);
    if ((rows[0] as { n: number }).n > 0) return;
    if (Date.now() > deadline) throw new Error(`no session blocked on a lock running "${queryPrefix}…" within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 20));
  }
}
