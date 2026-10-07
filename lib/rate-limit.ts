// Scan guards (spec §4 rule 8), all counted in Postgres from `scan` rows — no in-memory state, so
// they hold across serverless instances. Callers that need the counts to be race-free run these
// inside a transaction that has already locked the user's `profile` row (lib/scans/service.ts).
import { and, count, eq, gt, gte } from "drizzle-orm";
import type { Db, Tx } from "@/lib/db/client";
import { scan } from "@/lib/db/schema";

export const SCAN_RATE_LIMIT = { max: 5, windowMs: 60_000 } as const;
/** Model-calling (charged) scans per user per UTC day — refunded scans still count (stops refund-loop abuse). */
export const DAILY_AI_SCANS_PER_USER = 25;

type Executor = Db | Tx;

export function utcDayStart(now: number): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Every scan the user created in the last 60 s (barcode, AI, failed or not). */
export async function recentScanCount(ex: Executor, userId: string, now: number): Promise<number> {
  const [row] = await ex.select({ n: count() }).from(scan)
    .where(and(eq(scan.userId, userId), gt(scan.createdAt, new Date(now - SCAN_RATE_LIMIT.windowMs))));
  return row?.n ?? 0;
}

/** Charged scans created since UTC midnight — for one user, or across all users when `userId` is null. */
export async function chargedScansToday(ex: Executor, userId: string | null, now: number): Promise<number> {
  const [row] = await ex.select({ n: count() }).from(scan)
    .where(and(eq(scan.charged, true), gte(scan.createdAt, utcDayStart(now)), userId ? eq(scan.userId, userId) : undefined));
  return row?.n ?? 0;
}

export async function isRateLimited(ex: Executor, userId: string, now: number): Promise<boolean> {
  return (await recentScanCount(ex, userId, now)) >= SCAN_RATE_LIMIT.max;
}

/** Daily caps for a model-calling scan: the user's own (429 DAILY_LIMIT) and the global one (503 SERVICE_BUSY). */
export async function dailyCapHit(ex: Executor, userId: string, now: number, globalCap: number): Promise<"DAILY_LIMIT" | "SERVICE_BUSY" | null> {
  if ((await chargedScansToday(ex, userId, now)) >= DAILY_AI_SCANS_PER_USER) return "DAILY_LIMIT";
  if ((await chargedScansToday(ex, null, now)) >= globalCap) return "SERVICE_BUSY";
  return null;
}
