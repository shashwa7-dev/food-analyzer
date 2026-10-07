import { desc, eq, gte, sql, and } from "drizzle-orm";
import { db, type Tx } from "@/lib/db/client";
import { creditTxn, profile, scan } from "@/lib/db/schema";
import type { PlanKey } from "./plans";
import { allowanceFor, currentPeriod, nextPeriodStart } from "./logic";

export class NoCreditsError extends Error {
  constructor() {
    super("No credits remaining this period.");
    this.name = "NoCreditsError";
  }
}

/**
 * Lazily rolls the caller's balance into the current UTC month, expiring any leftover
 * allowance from a previous period and granting the plan's allowance for this one.
 * Safe to call concurrently: the row lock on `profile` serializes competing callers, and
 * the unique idempotency keys on `credit_txn` make the expire/grant writes idempotent even
 * if two transactions both believed they were first.
 */
export async function ensureCurrentPeriod(userId: string, now: Date = new Date()): Promise<{ credits: number; period: string }> {
  const period = currentPeriod(now);
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(sql`
      SELECT plan, credits, allowance_period AS "allowancePeriod" FROM profile WHERE user_id = ${userId} FOR UPDATE`);
    const row = rows[0] as { plan: PlanKey; credits: number; allowancePeriod: string | null } | undefined;
    if (!row) throw new Error(`No profile for user ${userId}`);

    if (row.allowancePeriod === period) return { credits: row.credits, period };

    const allowance = allowanceFor(row.plan);
    if (row.allowancePeriod && row.credits > 0) {
      await tx.insert(creditTxn).values({
        userId, amount: -row.credits, type: "expire", idempotencyKey: `expire:${userId}:${row.allowancePeriod}`, balanceAfter: 0,
      }).onConflictDoNothing();
    }
    await tx.insert(creditTxn).values({
      userId, amount: allowance, type: "grant", idempotencyKey: `grant:${userId}:${period}`, balanceAfter: allowance,
    }).onConflictDoNothing();
    await tx.update(profile).set({ credits: allowance, allowancePeriod: period, updatedAt: new Date() }).where(eq(profile.userId, userId));

    return { credits: allowance, period };
  });
}

export async function getBalance(userId: string, now: Date = new Date()): Promise<{ credits: number; allowance: number; periodResetsAt: Date }> {
  const { credits } = await ensureCurrentPeriod(userId, now);
  const [row] = await db.select({ plan: profile.plan }).from(profile).where(eq(profile.userId, userId));
  if (!row) throw new Error(`No profile for user ${userId}`);
  return { credits, allowance: allowanceFor(row.plan), periodResetsAt: nextPeriodStart(now) };
}

/**
 * Charges 1 credit for an AI model call on `scanId`. Idempotent on `scan:{scanId}`: a
 * second call for the same scan is a no-op that returns the already-charged balance.
 * Must run inside the caller's transaction (`tx`) so a failed debit never leaves a
 * dangling ledger row — on `NoCreditsError` the caller's transaction rolls back.
 */
export async function debitForScan(tx: Tx, userId: string, scanId: string): Promise<{ balanceAfter: number }> {
  const inserted = await tx.insert(creditTxn).values({
    userId, amount: -1, type: "debit", idempotencyKey: `scan:${scanId}`, balanceAfter: 0, scanId,
  }).onConflictDoNothing().returning({ id: creditTxn.id });

  if (inserted.length === 0) {
    const [p] = await tx.select({ credits: profile.credits }).from(profile).where(eq(profile.userId, userId));
    if (!p) throw new Error(`No profile for user ${userId}`);
    return { balanceAfter: p.credits };
  }

  const updated = await tx.update(profile)
    .set({ credits: sql`${profile.credits} - 1`, updatedAt: new Date() })
    .where(and(eq(profile.userId, userId), gte(profile.credits, 1)))
    .returning({ credits: profile.credits });
  if (updated.length === 0) throw new NoCreditsError();

  const balanceAfter = updated[0]!.credits;
  await tx.update(creditTxn).set({ balanceAfter }).where(eq(creditTxn.id, inserted[0]!.id));
  await tx.update(scan).set({ charged: true }).where(eq(scan.id, scanId));
  return { balanceAfter };
}

/**
 * Refunds 1 credit for `scanId`. Idempotent on `refund:{scanId}`: returns `false` (no
 * balance change) if that scan was already refunded. Takes the caller's transaction so a
 * "mark scan failed + refund" flow can be atomic.
 */
export async function refundScan(tx: Tx, userId: string, scanId: string): Promise<boolean> {
  const inserted = await tx.insert(creditTxn).values({
    userId, amount: 1, type: "refund", idempotencyKey: `refund:${scanId}`, balanceAfter: 0, scanId,
  }).onConflictDoNothing().returning({ id: creditTxn.id });
  if (inserted.length === 0) return false;

  const [updated] = await tx.update(profile)
    .set({ credits: sql`${profile.credits} + 1`, updatedAt: new Date() })
    .where(eq(profile.userId, userId))
    .returning({ credits: profile.credits });
  if (!updated) throw new Error(`No profile for user ${userId}`);
  await tx.update(creditTxn).set({ balanceAfter: updated.credits }).where(eq(creditTxn.id, inserted[0]!.id));
  return true;
}

/** Convenience wrapper for callers that don't already have an open transaction. */
export async function refundScanStandalone(userId: string, scanId: string): Promise<boolean> {
  return db.transaction((tx) => refundScan(tx, userId, scanId));
}

export async function listTransactions(userId: string, limit = 50) {
  return db.select().from(creditTxn).where(eq(creditTxn.userId, userId)).orderBy(desc(creditTxn.createdAt)).limit(limit);
}
