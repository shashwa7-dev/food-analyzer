// Account-deletion tombstones (final review I4): deleting the account and signing up again with the
// same email must not reset this month's AI scans or today's 25/day cap. The tombstone keeps only an
// HMAC of the normalised email plus usage counts — no plain PII — and survives the user row's deletion.
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/client";
import { creditTombstone } from "@/lib/db/schema";
import { chargedScansToday, utcDayStart } from "@/lib/rate-limit";
import type { PlanKey } from "./plans";
import { allowanceFor, currentPeriod } from "./logic";

/**
 * HMAC-SHA256 of the trimmed, lower-cased email. Keyed by CREDIT_TOMBSTONE_PEPPER, falling back to
 * BETTER_AUTH_SECRET (rotating whichever is used orphans existing tombstones — they then simply stop
 * matching, which fails open to a normal fresh grant).
 */
export function emailHash(email: string): string {
  const pepper = process.env.CREDIT_TOMBSTONE_PEPPER || process.env.BETTER_AUTH_SECRET;
  if (!pepper) throw new Error("CREDIT_TOMBSTONE_PEPPER or BETTER_AUTH_SECRET must be set");
  return createHmac("sha256", pepper).update(email.trim().toLowerCase()).digest("hex");
}

export const utcDay = (now: Date): string => utcDayStart(now.getTime()).toISOString().slice(0, 10);

/**
 * Records the user's usage for the current period and UTC day before their account is deleted. Must
 * run in the deleting transaction: the profile row lock serialises it with any in-flight debit.
 * Repeated deletions within one period keep the larger count (a seeded account's own count already
 * includes what it was seeded with).
 */
export async function recordTombstone(tx: Tx, userId: string, now: Date): Promise<void> {
  const { rows } = await tx.execute(sql`
    SELECT u.email, p.plan, p.credits, p.allowance_period AS "allowancePeriod", p.carried_day::text AS "carriedDay", p.carried_day_scans AS "carriedDayScans"
    FROM profile p JOIN "user" u ON u.id = p.user_id WHERE p.user_id = ${userId} FOR UPDATE OF p`);
  const row = rows[0] as { email: string; plan: PlanKey; credits: number; allowancePeriod: string | null; carriedDay: string | null; carriedDayScans: number } | undefined;
  if (!row) return;

  const period = currentPeriod(now);
  const day = utcDay(now);
  const used = row.allowancePeriod === period ? Math.max(0, allowanceFor(row.plan) - row.credits) : 0;
  const dayScans = (await chargedScansToday(tx, userId, now.getTime())) + (row.carriedDay === day ? row.carriedDayScans : 0);

  await tx.insert(creditTombstone).values({ emailHash: emailHash(row.email), period, used, day, dayScans })
    .onConflictDoUpdate({
      target: creditTombstone.emailHash,
      set: {
        used: sql`CASE WHEN ${creditTombstone.period} = excluded.period THEN GREATEST(${creditTombstone.used}, excluded.used) ELSE excluded.used END`,
        period: sql`excluded.period`,
        dayScans: sql`CASE WHEN ${creditTombstone.day} = excluded.day THEN GREATEST(${creditTombstone.dayScans}, excluded.day_scans) ELSE excluded.day_scans END`,
        day: sql`excluded.day`,
        updatedAt: sql`now()`,
      },
    });
}

/** What a deleted account with this user's email used in the current period and UTC day (zeros when none). */
export async function carriedUsage(tx: Tx, userId: string, now: Date): Promise<{ used: number; dayScans: number; day: string }> {
  const day = utcDay(now);
  const { rows } = await tx.execute(sql`SELECT email FROM "user" WHERE id = ${userId}`);
  const email = (rows[0] as { email: string } | undefined)?.email;
  if (!email) return { used: 0, dayScans: 0, day };
  const [t] = await tx.select().from(creditTombstone).where(eq(creditTombstone.emailHash, emailHash(email)));
  return {
    used: t && t.period === currentPeriod(now) ? t.used : 0,
    dayScans: t && t.day === day ? t.dayScans : 0,
    day,
  };
}
