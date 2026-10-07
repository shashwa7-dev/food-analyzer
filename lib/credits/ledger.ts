import { eq, gte, sql, and } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/lib/db/client";
import { creditTxn, profile, scan } from "@/lib/db/schema";
import type { PlanKey } from "./plans";
import { allowanceFor, currentPeriod, nextPeriodStart } from "./logic";
import { carriedUsage } from "./tombstone";
import type { ActivityFilter, ActivityItem } from "./activity";
import { InvalidError } from "@/lib/errors";
import { inputKindLabel } from "@/lib/scans/history";

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
  // A brand-new user id (first grant ever) may be a deleted account signing up again: carry over what
  // that account already used this period and today (credit_tombstone), so deleting doesn't reset them.
  const carried = row.allowancePeriod === null ? await carriedUsage(tx, userId, now) : null;
  const granted = Math.max(0, allowance - (carried?.used ?? 0));
  await tx.insert(creditTxn).values({
    userId, amount: granted, type: "grant", idempotencyKey: `grant:${userId}:${period}`, balanceAfter: granted,
    ...(carried?.used ? { meta: { carriedOver: carried.used } } : {}),
  }).onConflictDoNothing();
  await tx.update(profile).set({
    credits: granted, allowancePeriod: period, updatedAt: new Date(),
    ...(carried?.dayScans ? { carriedDay: carried.day, carriedDayScans: carried.dayScans } : {}),
  }).where(eq(profile.userId, userId));

  return { credits: granted, period, plan: row.plan, allowance };
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

// --- Activity (credits page, spec §6.14) ------------------------------------------------------------

const ACTIVITY_PAGE = 30;
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * One union of everything the activity list shows: grants, purchases, debits and refunds from
 * `credit_txn` (joined to their scan for its name, grade and input kind), plus free barcode scans
 * from `scan` (found products only, not deleted). A debit whose scan was refunded is left out: the
 * refund row stands for that scan, and it never counted against the month. `seq` breaks timestamp
 * ties so that newest-first lists a month's first debit above the grant made in its transaction.
 */
const activityItems = (userId: string) => sql`
  SELECT t.id, CASE t.type WHEN 'debit' THEN 'used' WHEN 'refund' THEN 'refund' ELSE 'grant' END AS kind,
    t.type::text AS txn_type, t.amount, t.scan_id, t.created_at AS at, t.idempotency_key AS key, t.meta,
    s.id IS NOT NULL AND s.deleted_at IS NULL AS linkable, s.deleted_at IS NOT NULL AS deleted,
    s.status::text AS status, s.input_kind::text AS input_kind,
    s.result->>'name' AS name, s.result->>'grade' AS grade,
    CASE WHEN jsonb_typeof(s.result->'items') = 'array' THEN jsonb_array_length(s.result->'items') END AS item_count,
    CASE WHEN t.type IN ('grant', 'purchase') THEN 0 ELSE 1 END AS seq
  FROM credit_txn t
  LEFT JOIN scan s ON s.id = t.scan_id AND s.user_id = t.user_id
  WHERE t.user_id = ${userId}
    AND t.type IN ('grant', 'purchase', 'debit', 'refund')
    AND NOT (t.type = 'debit' AND EXISTS (
      SELECT 1 FROM credit_txn r WHERE r.user_id = t.user_id AND r.type = 'refund' AND r.scan_id = t.scan_id))
  UNION ALL
  SELECT s.id, 'free', 'free', 0, s.id, s.created_at, NULL, NULL,
    TRUE, FALSE, s.status::text, s.input_kind::text,
    s.result->>'name', s.result->>'grade', NULL, 1
  FROM scan s
  WHERE s.user_id = ${userId} AND s.charged = FALSE AND s.barcode IS NOT NULL AND s.status = 'done'
    AND s.result IS NOT NULL AND s.deleted_at IS NULL`;

const KIND_FOR_FILTER: Record<Exclude<ActivityFilter, "all">, ActivityItem["kind"]> = { used: "used", free: "free", refunds: "refund" };

// Keyset cursor "<at, microseconds>~<seq>~<id>". credit_txn.created_at comes from the DB's now(), so
// it carries microseconds a JS Date would drop; the cursor keeps Postgres' own text of it.
const CursorSchema = z.string().max(120).transform((c, ctx) => {
  const [at, seq, id] = c.split("~");
  if (!at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(at) || (seq !== "0" && seq !== "1") || !z.uuid().safeParse(id).success) {
    ctx.addIssue({ code: "custom", message: "Invalid cursor." });
    return z.NEVER;
  }
  return { at, seq: Number(seq), id: id! };
});

type ActivityRow = {
  id: string; kind: ActivityItem["kind"]; txn_type: string; amount: number; scan_id: string | null; at: Date | string; at_text: string;
  key: string | null; meta: Record<string, unknown> | null; linkable: boolean; deleted: boolean; status: string | null;
  input_kind: string | null; name: string | null; grade: string | null; item_count: number | null; seq: number;
};

function grantTitle(r: ActivityRow): string {
  if (r.txn_type === "purchase") return "Credit purchase";
  const m = /:(\d{4})-(\d{2})$/.exec(r.key ?? "");
  const month = m ? Number(m[2]) - 1 : new Date(r.at).getUTCMonth();
  return `${MONTH_LONG[month]} allowance`;
}

function scanTitle(r: ActivityRow): string {
  if (r.name) return r.name;
  if (r.status === "failed") return "Couldn't read photo";
  if (r.status === "queued" || r.status === "processing") return "Scan in progress";
  return "AI scan";
}

function toActivityItem(r: ActivityRow): ActivityItem {
  const base = {
    id: r.id, kind: r.kind, at: new Date(r.at).toISOString(), amount: r.amount, scanId: r.scan_id,
    linkable: r.scan_id !== null && r.linkable, inputKind: r.input_kind as ActivityItem["inputKind"],
  };
  if (r.kind === "grant") {
    const carried = typeof r.meta?.carriedOver === "number" ? r.meta.carriedOver : 0;
    return { ...base, title: grantTitle(r), meta: carried ? `${carried} already used this month` : "Monthly AI scans", scanId: null, linkable: false, inputKind: null };
  }
  if (r.kind === "refund") return { ...base, title: scanTitle(r), meta: "Refunded automatically" };
  const detail = r.grade ? `grade ${r.grade}` : r.item_count ? `${r.item_count} ${r.item_count === 1 ? "item" : "items"}` : null;
  const meta = [inputKindLabel(r.input_kind) ?? "AI scan", detail, r.deleted ? "deleted" : null].filter(Boolean).join(" · ");
  return { ...base, title: scanTitle(r), meta };
}

/**
 * GET /credits/activity — the user's credit activity, newest first, 30 a page. `filter` narrows to
 * used scans, free barcode scans or refunds. Throws InvalidError on a malformed cursor.
 */
export async function listActivity(userId: string, filter: ActivityFilter, cursor?: string): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  let c: { at: string; seq: number; id: string } | null = null;
  if (cursor) {
    const parsed = CursorSchema.safeParse(cursor);
    if (!parsed.success) throw new InvalidError("Invalid cursor.");
    c = parsed.data;
  }
  const kind = filter === "all" ? null : KIND_FOR_FILTER[filter];
  const { rows } = await db.execute(sql`
    SELECT a.*, to_char(a.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at_text
    FROM (${activityItems(userId)}) a
    WHERE TRUE
      ${kind ? sql`AND a.kind = ${kind}` : sql``}
      ${c ? sql`AND (a.at, a.seq, a.id) < (${c.at}::timestamptz, ${c.seq}, ${c.id}::uuid)` : sql``}
    ORDER BY a.at DESC, a.seq DESC, a.id DESC
    LIMIT ${ACTIVITY_PAGE + 1}`);
  const list = rows as ActivityRow[];
  const page = list.slice(0, ACTIVITY_PAGE);
  const last = page.at(-1);
  return {
    items: page.map(toActivityItem),
    nextCursor: list.length > ACTIVITY_PAGE && last ? `${last.at_text}~${last.seq}~${last.id}` : null,
  };
}

/** This period's counts for the credits page's stat tiles: AI scans used (refunded ones excluded), free barcode scans, refunds. */
export async function countActivity(userId: string, now: Date = new Date()): Promise<{ used: number; free: number; refunded: number }> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { rows } = await db.execute(sql`
    SELECT count(*) FILTER (WHERE a.kind = 'used')::int AS used,
      count(*) FILTER (WHERE a.kind = 'free')::int AS free,
      count(*) FILTER (WHERE a.kind = 'refund')::int AS refunded
    FROM (${activityItems(userId)}) a
    WHERE a.at >= ${since.toISOString()}::timestamptz`);
  const r = rows[0] as { used: number; free: number; refunded: number } | undefined;
  return { used: r?.used ?? 0, free: r?.free ?? 0, refunded: r?.refunded ?? 0 };
}

/**
 * Every balance change this period, oldest first, for the balance chart. A reset writes the old
 * period's expiry and the new grant in one transaction (same timestamp), and the month's first debit
 * can share it too, so ties order expire → grant → the rest.
 */
export async function periodBalances(userId: string, now: Date = new Date()): Promise<{ at: string; balanceAfter: number; type: string }[]> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db.select({ at: creditTxn.createdAt, balanceAfter: creditTxn.balanceAfter, type: creditTxn.type }).from(creditTxn)
    .where(and(eq(creditTxn.userId, userId), gte(creditTxn.createdAt, since)))
    .orderBy(creditTxn.createdAt, sql`CASE ${creditTxn.type} WHEN 'expire' THEN 0 WHEN 'grant' THEN 1 ELSE 2 END`, creditTxn.id);
  return rows.map((r) => ({ at: r.at.toISOString(), balanceAfter: r.balanceAfter, type: r.type }));
}
