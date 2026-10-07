// Scan lifecycle (spec §4, §8 rev 4): free barcode path decided synchronously, AI path charged in the
// same transaction that creates the scan, the model call finished in a background job, and every
// terminal write conditional on the scan still running — so a sweep, a delete and a late job can
// race freely and the user is charged at most once and refunded at most once.
import { GRADE_UNAVAILABLE } from "@/lib/nutrition/grade-unavailable";
import { and, count, desc, eq, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/lib/db/client";
import { scan } from "@/lib/db/schema";
import { debitForScan, ensureCurrentPeriod, ensureCurrentPeriodTx, NoCreditsError, refundScan } from "@/lib/credits/ledger";
import { ENGINE_VERSION, resolveBarcode, runAi, type AiOutcome, type EngineDeps, type EngineInput, type ExtractOutput, type FoodLike } from "@/lib/engine";
import { EngineError } from "@/lib/engine/errors";
import type { ScanResult } from "@/lib/engine/result";
import type { EngineImage } from "@/lib/engine/schema";
import { InvalidError } from "@/lib/errors";
import { targetsFor } from "@/lib/nutrition/targets";
import { getProfile } from "@/lib/profile/service";
import { dailyCapHit, isRateLimited } from "@/lib/rate-limit";
import { crowdDraft, upsertCrowdFood } from "./crowd";
import { NOT_CONFIGURED_MESSAGE, SCAN_MESSAGES, scanErrorMessage, type ScanErrorCode } from "./messages";

/** One model-time budget per scan, counted from the start of the request (route maxDuration is 60 s). */
export const SCAN_DEADLINE_MS = 50_000;
/** queued/processing scans older than this are certainly dead (> maxDuration + margin) and are swept. */
export const STUCK_AFTER_MS = 3 * 60_000;
const RUNNING = ["queued", "processing"] as const;

export interface ScanDeps extends EngineDeps {
  /** Read per call (never at import), so the app builds and boots without the model key. */
  config(): { aiEnabled: boolean; dailyAiScanCap: number };
}
export type Schedule = (fn: () => Promise<void>) => void;

export interface CreateScanInput {
  images: EngineImage[];
  barcode: string | null; // already normalised by parseScanForm
  /** The client's `Idempotency-Key` (one per Analyse press). */
  clientRequestId?: string | null;
  /** Epoch ms; request start + SCAN_DEADLINE_MS. Defaults to deps.now() + SCAN_DEADLINE_MS. */
  deadline?: number;
}

type ScanRow = typeof scan.$inferSelect;
type ScanStatus = ScanRow["status"];

export interface ScanView {
  id: string;
  status: ScanStatus;
  inputKind: ScanRow["inputKind"];
  barcode: string | null;
  /** Photos sent with the scan (never stored — just the count, for "Read from 2 photos"). */
  imageCount: number;
  /** A credit was taken for this scan (AI path); false for free barcode scans. */
  charged: boolean;
  result: ScanResult | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** A charged scan that failed. Always refunded: the fail write and the refund share one transaction. */
  refunded: boolean;
  createdAt: string;
}

export type CreateScanResult =
  | { status: 200 | 202; body: ScanView & { scanId: string } }
  | { status: 402 | 409 | 429 | 503; body: { error: { code: ScanErrorCode; message: string } } };

/**
 * The user's own, not-deleted scans — every user-facing scan read (get, list, delete, and logging /
 * saving from a scan in later tasks) must go through this. Guards (rate limit, daily caps,
 * daily_ai_cost) deliberately do NOT: a deleted scan still counts.
 */
export function visibleScanWhere(userId: string): SQL {
  return and(eq(scan.userId, userId), isNull(scan.deletedAt))!;
}

/** The user's non-deleted scan count — the sidebar's History badge. */
export async function countVisibleScans(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(scan).where(visibleScanWhere(userId));
  return row?.n ?? 0;
}

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const isRunning = (s: ScanStatus) => (RUNNING as readonly string[]).includes(s);

function toView(row: ScanRow): ScanView {
  const refunded = row.status === "failed" && row.charged;
  return {
    id: row.id, status: row.status, inputKind: row.inputKind, barcode: row.barcode, imageCount: row.imageCount, charged: row.charged,
    result: row.result ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorCode ? scanErrorMessage(row.errorCode, { specific: row.errorMessage, refunded }) : null,
    refunded, createdAt: row.createdAt.toISOString(),
  };
}

function ok(row: ScanRow): CreateScanResult {
  if (row.deletedAt) return fail(409, "CONFLICT"); // Idempotency-Key replay of a scan the user deleted
  return { status: isRunning(row.status) ? 202 : 200, body: { scanId: row.id, ...toView(row) } };
}

function fail(status: 402 | 409 | 429 | 503, code: ScanErrorCode, message = SCAN_MESSAGES[code]): CreateScanResult {
  return { status, body: { error: { code, message } } };
}

async function lockProfile(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT 1 FROM profile WHERE user_id = ${userId} FOR UPDATE`);
}

/** Includes soft-deleted scans, so a replay after delete is answered (409) instead of creating a new charged scan. */
async function findByClientRequestId(ex: Db | Tx, userId: string, key: string): Promise<ScanRow | null> {
  const [row] = await ex.select().from(scan).where(and(eq(scan.userId, userId), eq(scan.clientRequestId, key)));
  return row ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

/**
 * The one failure write: conditional on the scan still running, and refunding in the same
 * transaction only when that update hit a row and the scan was charged. Returns whether it hit.
 */
async function failScanTx(tx: Tx, userId: string, scanId: string, code: ScanErrorCode, now: number, specific: string | null = null): Promise<boolean> {
  const rows = await tx.update(scan)
    .set({ status: "failed", errorCode: code, errorMessage: specific, doneAt: new Date(now) })
    .where(and(eq(scan.id, scanId), eq(scan.userId, userId), inArray(scan.status, RUNNING)))
    .returning({ charged: scan.charged });
  if (rows.length === 0) return false;
  if (rows[0]!.charged) await refundScan(tx, userId, scanId);
  return true;
}

/** Fails + refunds this user's scans stuck in queued/processing for longer than STUCK_AFTER_MS. */
export async function sweepStuck(userId: string, now: number = Date.now()): Promise<void> {
  const stale = await db.select({ id: scan.id }).from(scan)
    .where(and(eq(scan.userId, userId), inArray(scan.status, RUNNING), lt(scan.createdAt, new Date(now - STUCK_AFTER_MS))));
  for (const s of stale) await db.transaction((tx) => failScanTx(tx, userId, s.id, "TIMEOUT", now));
}

async function engineProfile(userId: string): Promise<EngineInput["profile"]> {
  const p = await getProfile(userId);
  return { country: p.country, allergies: p.allergies, diet: p.diet, goal: p.goal, targets: targetsFor(p.goal, p.targets) };
}

type TxOutcome = { kind: "row"; row: ScanRow; created: boolean } | { kind: "limit"; result: CreateScanResult };

/**
 * Runs `body` serialised per user (profile row lock), after re-checking the idempotency key and the
 * 5-per-60 s rate limit under that lock. A unique violation on (user_id, client_request_id) — which
 * the lock should already prevent — falls back to replaying the stored scan.
 */
async function serialised(userId: string, key: string | null, now: number, body: (tx: Tx) => Promise<TxOutcome>): Promise<TxOutcome> {
  try {
    return await db.transaction(async (tx) => {
      await lockProfile(tx, userId);
      if (key) {
        const existing = await findByClientRequestId(tx, userId, key);
        if (existing) return { kind: "row", row: existing, created: false };
      }
      if (await isRateLimited(tx, userId, now)) return { kind: "limit", result: fail(429, "RATE_LIMITED") };
      return body(tx);
    });
  } catch (err) {
    if (key && isUniqueViolation(err)) {
      const existing = await findByClientRequestId(db, userId, key);
      if (existing) return { kind: "row", row: existing, created: false };
    }
    throw err;
  }
}

/**
 * POST /scans after parsing: replay → rate limit → lazy reset → barcode (free, may finish here) →
 * key check → [locked: daily caps → balance → insert queued + debit] → 202 + background job.
 */
export async function createScan(userId: string, input: CreateScanInput, deps: ScanDeps, schedule: Schedule): Promise<CreateScanResult> {
  const now = deps.now();
  const deadline = input.deadline ?? now + SCAN_DEADLINE_MS;
  const key = input.clientRequestId ?? null;

  await sweepStuck(userId, now);
  if (key) {
    const existing = await findByClientRequestId(db, userId, key);
    if (existing) return ok(existing);
  }
  // Cheap unlocked pre-check, so a limited user never reaches Open Food Facts; re-checked under the lock.
  if (await isRateLimited(db, userId, now)) return fail(429, "RATE_LIMITED");
  await ensureCurrentPeriod(userId, new Date(now));

  const engineInput: EngineInput = { barcode: input.barcode, images: input.images, profile: await engineProfile(userId) };
  const outcome = await resolveBarcode(engineInput, deps);

  if (outcome.kind !== "needs_ai") {
    const done = outcome.kind === "barcode_done";
    const res = await serialised(userId, key, now, async (tx) => {
      const [row] = await tx.insert(scan).values({
        userId, status: "done", inputKind: "barcode", barcode: input.barcode, imageCount: input.images.length,
        foodId: done ? outcome.foodId : null, result: done ? outcome.result : null, confidence: done ? outcome.result.confidence : null,
        errorCode: done ? null : "BARCODE_NOT_FOUND", engineVersion: ENGINE_VERSION, clientRequestId: key, charged: false,
        createdAt: new Date(now), startedAt: new Date(now), doneAt: new Date(now), // explicit (ms) — see the list cursor
      }).returning();
      return { kind: "row", row: row!, created: true };
    });
    return res.kind === "limit" ? res.result : ok(res.row);
  }

  const config = deps.config();
  if (!config.aiEnabled) return fail(503, "SERVICE_BUSY", NOT_CONFIGURED_MESSAGE);

  let res: TxOutcome;
  try {
    res = await serialised(userId, key, now, async (tx) => {
      const cap = await dailyCapHit(tx, userId, now, config.dailyAiScanCap);
      if (cap === "DAILY_LIMIT") return { kind: "limit", result: fail(429, "DAILY_LIMIT") };
      if (cap === "SERVICE_BUSY") return { kind: "limit", result: fail(503, "SERVICE_BUSY") };
      const { credits } = await ensureCurrentPeriodTx(tx, userId, new Date(now));
      if (credits < 1) return { kind: "limit", result: fail(402, "NO_CREDITS") };

      const [row] = await tx.insert(scan).values({
        userId, status: "queued", barcode: input.barcode, imageCount: input.images.length, engineVersion: ENGINE_VERSION,
        clientRequestId: key, createdAt: new Date(now), // explicit (ms) — see the list cursor
      }).returning();
      await debitForScan(tx, userId, row!.id, new Date(now)); // NoCreditsError rolls the scan row back too
      return { kind: "row", row: { ...row!, charged: true }, created: true };
    });
  } catch (err) {
    if (err instanceof NoCreditsError) return fail(402, "NO_CREDITS");
    throw err;
  }
  if (res.kind === "limit") return res.result;
  if (res.created) {
    const { barcodeFood, offNotFound } = outcome;
    schedule(() => completeScan(res.row.id, userId, engineInput, deps, { deadline, barcodeFood, offNotFound }));
  }
  return ok(res.row);
}

class Superseded extends Error {}

function usageColumns(u: Pick<ExtractOutput, "usage" | "modelId" | "costMicros">) {
  return { modelId: u.modelId, tokensIn: u.usage.inputTokens, tokensOut: u.usage.outputTokens, costMicros: u.costMicros };
}

/** Cost accounting only (never status): records the model call's usage on a scan that has none yet. */
async function recordUsage(scanId: string, userId: string, u: Pick<ExtractOutput, "usage" | "modelId" | "costMicros"> | null) {
  if (!u) return;
  await db.update(scan).set(usageColumns(u)).where(and(eq(scan.id, scanId), eq(scan.userId, userId), sql`${scan.costMicros} IS NULL`));
}

async function failSafely(scanId: string, userId: string, err: unknown, now: number, usage: ExtractOutput | null) {
  const code: ScanErrorCode = err instanceof EngineError ? err.code : "MODEL_ERROR";
  // EngineError messages are fixed, user-safe sentences; keep one only when it says more than the code's own.
  const specific = err instanceof EngineError && err.message !== SCAN_MESSAGES[code] && err.message !== code ? err.message : null;
  if (!(err instanceof EngineError)) console.error("scan job failed", { scanId, err });
  else if (code === "MODEL_ERROR" || code === "TIMEOUT") {
    // Provider failures (revoked key, billing, 400s) would otherwise be silent. Never log the request body (base64 images).
    const c = err.cause as { name?: unknown; statusCode?: unknown; message?: unknown } | undefined;
    console.error("scan model call failed", { scanId, code, cause: c && { name: c.name, statusCode: c.statusCode, message: typeof c.message === "string" ? c.message.slice(0, 300) : undefined } });
  }
  try {
    await db.transaction((tx) => failScanTx(tx, userId, scanId, code, now, specific));
    await recordUsage(scanId, userId, usage);
  } catch (e) {
    // The stuck sweep fails + refunds it later.
    console.error("scan job could not record failure", { scanId, e });
  }
}

/**
 * The background job (run via Next's `after`). Never throws. queued → processing (conditional; a swept
 * or deleted scan is left alone) → engine → one transaction: crowd food upsert (savepoint; a failure
 * there never fails the scan) + conditional `done` write. If that write misses (swept/deleted
 * meanwhile) the crowd upsert is rolled back; any error fails + refunds the scan.
 */
export async function completeScan(
  scanId: string,
  userId: string,
  input: EngineInput,
  deps: ScanDeps,
  opts: { deadline: number; barcodeFood?: FoodLike | null; offNotFound?: boolean },
): Promise<void> {
  try {
    const started = await db.update(scan).set({ status: "processing", startedAt: new Date(deps.now()) })
      .where(and(eq(scan.id, scanId), eq(scan.userId, userId), eq(scan.status, "queued")))
      .returning({ id: scan.id });
    if (started.length === 0) return;
  } catch (e) {
    console.error("scan job could not start", { scanId, e });
    return;
  }

  let usage: ExtractOutput | null = null;
  const tracked: ScanDeps = {
    ...deps,
    extract: async (images, o) => {
      const r = await deps.extract(images, o);
      usage = r;
      return r;
    },
  };

  let ai: AiOutcome;
  try {
    ai = await runAi(input, tracked, opts.deadline, opts.barcodeFood ?? null, opts.offNotFound ?? false);
  } catch (err) {
    await failSafely(scanId, userId, err, deps.now(), usage);
    return;
  }

  try {
    await db.transaction(async (tx) => {
      let crowdFoodId: string | null = null;
      const candidate = ai.crowdCandidate;
      if (candidate) {
        try {
          crowdFoodId = await tx.transaction((sp) => upsertCrowdFood(sp, crowdDraft(candidate, input.profile.country)));
        } catch (e) {
          console.error("crowd food upsert failed", { scanId, e });
        }
      }
      const result: ScanResult = crowdFoodId ? { ...ai.result, foodId: crowdFoodId } : ai.result;
      const rows = await tx.update(scan)
        .set({
          status: "done", result, foodId: crowdFoodId ?? ai.result.foodId, confidence: result.confidence, inputKind: result.inputKind,
          ...usageColumns(ai), doneAt: new Date(deps.now()),
        })
        .where(and(eq(scan.id, scanId), eq(scan.userId, userId), inArray(scan.status, RUNNING)))
        .returning({ id: scan.id });
      if (rows.length === 0) throw new Superseded();
    });
  } catch (err) {
    if (err instanceof Superseded) {
      await recordUsage(scanId, userId, ai).catch(() => undefined);
      return;
    }
    await failSafely(scanId, userId, err, deps.now(), usage);
  }
}

/** GET /scans/:id — owner-scoped (foreign or malformed id → null), sweeping this scan if stuck. */
export async function getScan(userId: string, id: string, now: number = Date.now()): Promise<ScanView | null> {
  if (!isUuid(id)) return null;
  const read = async () => (await db.select().from(scan).where(and(eq(scan.id, id), visibleScanWhere(userId))))[0] ?? null;
  let row = await read();
  if (!row) return null;
  if (isRunning(row.status) && row.createdAt.getTime() < now - STUCK_AFTER_MS) {
    await db.transaction((tx) => failScanTx(tx, userId, id, "TIMEOUT", now));
    row = await read();
    if (!row) return null;
  }
  return toView(row);
}

/**
 * DELETE /scans/:id — a soft delete: the row stays (deleted_at set) so the rate limit, daily caps and
 * daily_ai_cost keep counting it; otherwise create → fail (refunded) → delete would be an unlimited
 * loop of paid model calls. A running scan is first failed (+ refunded) in the same transaction, so
 * the job's later write is a no-op. Account deletion still cascades the rows away.
 */
export async function deleteScan(userId: string, id: string, now: number = Date.now()): Promise<boolean> {
  if (!isUuid(id)) return false;
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ status: scan.status }).from(scan).where(and(eq(scan.id, id), visibleScanWhere(userId))).for("update");
    if (!row) return false;
    if (isRunning(row.status)) await failScanTx(tx, userId, id, "MODEL_ERROR", now);
    await tx.update(scan).set({ deletedAt: new Date(now) }).where(and(eq(scan.id, id), eq(scan.userId, userId)));
    return true;
  });
}

// --- History ---------------------------------------------------------------------------------------

export const ListScansSchema = z.object({
  cursor: z.string().max(100).optional(),
  grade: z.enum(["A", "B", "C", "D", "E"]).optional(),
  q: z.string().trim().min(1).max(60).optional(),
});
export type ListScansQuery = z.infer<typeof ListScansSchema>;

export interface ScanListItem {
  id: string;
  status: ScanStatus;
  inputKind: ScanRow["inputKind"];
  /** Whether the scan cost a credit (false for a barcode found in the food database). */
  charged: boolean;
  confidence: ScanRow["confidence"];
  errorCode: string | null;
  name: string | null;
  brand: string | null;
  grade: string | null;
  kind: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

// Opaque keyset cursor "<createdAt ISO>~<id>" (a bare ISO timestamp is accepted too), so scans sharing
// a millisecond are never skipped or repeated between pages. ISO round-trips only milliseconds: this
// relies on every scan insert setting createdAt explicitly from a JS Date (never the DB's microsecond
// now() default) — keep it that way.
const encodeCursor = (createdAt: Date, id: string) => `${createdAt.toISOString()}~${id}`;
function decodeCursor(cursor: string): { at: Date; id: string | null } {
  const [iso, id] = cursor.split("~");
  const at = new Date(iso ?? "");
  if (Number.isNaN(at.getTime()) || (id !== undefined && !isUuid(id))) throw new InvalidError("Invalid cursor.");
  return { at, id: id ?? null };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * GET /scans — the user's scans, newest first, sweeping their stale ones first. `pageSize` is for
 * server callers that show a few (Today's Recent scans). Throws InvalidError on bad input.
 */
export async function listScans(
  userId: string, query: ListScansQuery, now: number = Date.now(), pageSize: number = PAGE_SIZE,
): Promise<{ scans: ScanListItem[]; nextCursor: string | null }> {
  const q = ListScansSchema.safeParse(query);
  if (!q.success) throw new InvalidError();
  const { cursor, grade, q: text } = q.data;
  const c = cursor ? decodeCursor(cursor) : null;

  await sweepStuck(userId, now);
  const name = sql<string | null>`${scan.result}->>'name'`;
  const rows = await db.select({
    id: scan.id, status: scan.status, inputKind: scan.inputKind, charged: scan.charged, confidence: scan.confidence, errorCode: scan.errorCode,
    createdAt: scan.createdAt, name, brand: sql<string | null>`${scan.result}->>'brand'`,
    // A result whose grade is unavailable (lib/nutrition/grade-unavailable.ts) lists as "?".
    grade: sql<string | null>`COALESCE(${scan.result}->>'grade', CASE WHEN ${scan.result}->>'gradeUnavailable' IS NOT NULL THEN ${GRADE_UNAVAILABLE} END)`, kind: sql<string | null>`${scan.result}->>'kind'`,
  }).from(scan)
    .where(and(
      visibleScanWhere(userId),
      c ? (c.id ? sql`(${scan.createdAt}, ${scan.id}) < (${c.at}, ${c.id})` : lt(scan.createdAt, c.at)) : undefined,
      grade ? sql`${scan.result}->>'grade' = ${grade}` : undefined,
      text ? sql`${name} ILIKE ${`%${escapeLike(text)}%`}` : undefined,
    ))
    .orderBy(desc(scan.createdAt), desc(scan.id))
    .limit(pageSize + 1);

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    scans: page.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    nextCursor: rows.length > pageSize && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}
