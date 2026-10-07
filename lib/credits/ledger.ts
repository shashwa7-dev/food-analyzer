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

export class ScanNotFoundError extends Error {
  constructor() {
    super("Scan not found.");
    this.name = "ScanNotFoundError";
  }
}

type PeriodResult = { credits: number; period: string; plan: PlanKey; allowance: number };

/**
 * Lazily rolls the caller's balance into the current UTC month, expiring any leftover
 * allowance from a previous period and granting the plan's allowance for this one. Must
 * run inside the caller's transaction (`tx`) so callers that also spend in the same
 * transaction (e.g. `debitForScan`) see a consistent, already-reset balance — this is how
 * spec §4 rule 2 ("reset on read AND spend") is satisfied.
 *
 * Safe to call concurrently: the row lock on `profile` (via `FOR UPDATE`) serializes
 * competing callers, and the unique idempotency keys on `credit_txn` make the expire/grant
 * writes idempotent even if two transactions both believed they were first.
 *
 * The reset is monotonic: it only fires when the current period is strictly after the
 * stored one (`YYYY-MM` string comparison), so a skewed clock can never roll a balance
 * backwards or re-grant an already-current-or-future period.
 */
export async function ensureCurrentPeriodTx(tx: Tx, userId: string, now: Date = new Date()): Promise<PeriodResult> {
  const period = currentPeriod(now);
  const { rows } = await tx.execute(sql`
    SELECT plan, credits, allowance_period AS "allowancePeriod" FROM profile WHERE user_id = ${userId} FOR UPDATE`);
  const row = rows[0] as { plan: PlanKey; credits: number; allowancePeriod: string | null } | undefined;
  if (!row) throw new Error(`No profile for user ${userId}`);

  const allowance = allowanceFor(row.plan);
  const shouldReset = row.allowancePeriod === null || period > row.allowancePeriod;
  if (!shouldReset) return { credits: row.credits, period, plan: row.plan, allowance };

  if (row.allowancePeriod && row.credits > 0) {
    await tx.insert(creditTxn).values({
      userId, amount: -row.credits, type: "expire", idempotencyKey: `expire:${userId}:${row.allowancePeriod}`, balanceAfter: 0,
    }).onConflictDoNothing();
  }
  await tx.insert(creditTxn).values({
    userId, amount: allowance, type: "grant", idempotencyKey: `grant:${userId}:${period}`, balanceAfter: allowance,
  }).onConflictDoNothing();
  await tx.update(profile).set({ credits: allowance, allowancePeriod: period, updatedAt: new Date() }).where(eq(profile.userId, userId));

  return { credits: allowance, period, plan: row.plan, allowance };
}

/** Convenience wrapper for callers that don't already have an open transaction. */
export async function ensureCurrentPeriod(userId: string, now: Date = new Date()): Promise<{ credits: number; period: string }> {
  return db.transaction((tx) => ensureCurrentPeriodTx(tx, userId, now));
}

export async function getBalance(userId: string, now: Date = new Date()): Promise<{ credits: number; allowance: number; periodResetsAt: Date }> {
  const { credits, allowance } = await db.transaction((tx) => ensureCurrentPeriodTx(tx, userId, now));
  return { credits, allowance, periodResetsAt: nextPeriodStart(now) };
}

/**
 * Charges 1 credit for an AI model call on `scanId`. Idempotent on `scan:{scanId}`: a
 * second call for the same scan is a no-op that returns the already-charged balance.
 * Resets the caller's allowance for the current period first (spec §4 rule 2: reset on
 * read AND spend), so a fresh or stale-period user is granted their allowance before the
 * debit is attempted. Must run inside the caller's transaction (`tx`) so a failed debit
 * never leaves a dangling ledger row — on `NoCreditsError` the caller's transaction rolls
 * back. Verifies `scanId` belongs to `userId` first, throwing `ScanNotFoundError`
 * (never a 403-shaped error) and writing nothing if it doesn't or the scan is missing.
 */
export async function debitForScan(tx: Tx, userId: string, scanId: string, now: Date = new Date()): Promise<{ balanceAfter: number }> {
  const [s] = await tx.select({ userId: scan.userId }).from(scan).where(eq(scan.id, scanId));
  if (!s || s.userId !== userId) throw new ScanNotFoundError();

  await ensureCurrentPeriodTx(tx, userId, now);

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
  await tx.update(scan).set({ charged: true }).where(and(eq(scan.id, scanId), eq(scan.userId, userId)));
  return { balanceAfter };
}

/**
 * Refunds 1 credit for `scanId`. Idempotent on `refund:{scanId}`: returns `false` (no
 * balance change, nothing written) if that scan was already refunded, or if it was never
 * charged in the first place (no point refunding credit that was never debited — this also
 * closes a mint-from-nothing path for an attacker-supplied scan id). Never clears
 * `scan.charged`: that flag records "a debit happened", independent of later refunds.
 * Verifies `scanId` belongs to `userId` first, throwing `ScanNotFoundError` and writing
 * nothing if it doesn't or the scan is missing. Takes the caller's transaction so a
 * "mark scan failed + refund" flow can be atomic.
 */
export async function refundScan(tx: Tx, userId: string, scanId: string): Promise<boolean> {
  const [s] = await tx.select({ userId: scan.userId, charged: scan.charged }).from(scan).where(eq(scan.id, scanId));
  if (!s || s.userId !== userId) throw new ScanNotFoundError();
  if (!s.charged) return false;

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

// Within one reset transaction, `expire` and `grant` rows share the same `created_at`
// (Postgres `now()` is stable per transaction) — rank `grant` first since it's the newer
// logical event, then `debit`/`refund`/`purchase`, then `expire` last.
const TYPE_RANK = sql`CASE ${creditTxn.type}
  WHEN 'grant' THEN 0
  WHEN 'debit' THEN 1
  WHEN 'refund' THEN 1
  WHEN 'purchase' THEN 1
  WHEN 'expire' THEN 2
  ELSE 3 END`;

export async function listTransactions(userId: string, limit = 50) {
  const clampedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  return db.select().from(creditTxn)
    .where(eq(creditTxn.userId, userId))
    .orderBy(desc(creditTxn.createdAt), TYPE_RANK, desc(creditTxn.id))
    .limit(clampedLimit);
}
