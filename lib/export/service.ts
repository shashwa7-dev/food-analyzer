// The Pro data export (spec §B "CSV export"): each dataset's documented columns and a CSV stream of the
// signed-in user's rows, read a page at a time. Owner-scoped: every query filters on the caller's id.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { foodLog, scan } from "@/lib/db/schema";
import { csvLine, type CsvColumn } from "@/lib/export/csv";

/** Every export the API knows. `workouts` and `weight` arrive with the fitness tracker (Phase 2 Task 3). */
export const EXPORT_KINDS = ["diary", "scans", "workouts", "weight"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const PAGE = 500;

/**
 * A timestamp as "YYYY-MM-DD HH:mm" on the user's clock (profile.timezone), so a 01:00 IST entry shows
 * the same day as its diary `date`, not the UTC day before.
 */
export function localStamp(d: Date, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Logged amounts carry the snapshot's full precision; one decimal is plenty in a spreadsheet. */
function r1(v: number): number;
function r1(v: number | null | undefined): number | null;
function r1(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : Math.round(v * 10) / 10;
}

type DiaryRow = {
  date: string; meal: string; food: string; portion: string; amount: number; grams: number | null;
  energy_kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number | null; sugars_g: number | null;
  sat_fat_g: number | null; sodium_mg: number | null; grade: string | null; logged_at: string;
};

/**
 * Diary: one line per logged food, oldest first. Nutrients are for the logged amount, to one decimal;
 * blank when the source didn't give one. `logged_at` is "YYYY-MM-DD HH:mm" in the user's timezone (profile.timezone).
 */
export const DIARY_COLUMNS: CsvColumn<DiaryRow>[] = [
  { key: "date", header: "date" },
  { key: "meal", header: "meal" },
  { key: "food", header: "food" },
  { key: "portion", header: "portion" },
  { key: "amount", header: "amount" },
  { key: "grams", header: "grams" },
  { key: "energy_kcal", header: "energy_kcal" },
  { key: "protein_g", header: "protein_g" },
  { key: "carbs_g", header: "carbs_g" },
  { key: "fat_g", header: "fat_g" },
  { key: "fibre_g", header: "fibre_g" },
  { key: "sugars_g", header: "sugars_g" },
  { key: "sat_fat_g", header: "sat_fat_g" },
  { key: "sodium_mg", header: "sodium_mg" },
  { key: "grade", header: "grade" },
  { key: "logged_at", header: "logged_at" },
];

type ScanRow = {
  scanned_at: string; mode: string | null; status: string; name: string | null; brand: string | null; grade: string | null;
  confidence: string | null; barcode: string | null; basis: string | null; energy_kcal_per_100: number | null; error: string | null;
};

/**
 * Scans: every scan you haven't deleted, oldest first. Nutrition is per 100 g or ml (`basis`); a failed
 * scan has only `error`. `scanned_at` is "YYYY-MM-DD HH:mm" in the user's timezone (profile.timezone).
 */
export const SCAN_COLUMNS: CsvColumn<ScanRow>[] = [
  { key: "scanned_at", header: "scanned_at" },
  { key: "mode", header: "mode" },
  { key: "status", header: "status" },
  { key: "name", header: "name" },
  { key: "brand", header: "brand" },
  { key: "grade", header: "grade" },
  { key: "confidence", header: "confidence" },
  { key: "barcode", header: "barcode" },
  { key: "basis", header: "basis" },
  { key: "energy_kcal_per_100", header: "energy_kcal_per_100" },
  { key: "error", header: "error" },
];

// Keyset paging: each page starts after the last row of the one before, in the export's own order, so
// rows written while the export runs can't shift a page (no duplicates, no gaps, unlike OFFSET). The
// cursor keeps created_at as Postgres text: a JS Date would drop its microseconds and misplace ties.
const createdText = (col: typeof foodLog.createdAt | typeof scan.createdAt) => sql<string>`${col}::text`;

type DiaryCursor = { date: string; created: string; id: string };
type ScanCursor = { created: string; id: string };

function diaryPage(userId: string, after: DiaryCursor | null, pageSize: number) {
  return db.select({ row: foodLog, created: createdText(foodLog.createdAt) }).from(foodLog)
    .where(and(
      eq(foodLog.userId, userId),
      after ? sql`(${foodLog.date}, ${foodLog.createdAt}, ${foodLog.id}) > (${after.date}::date, ${after.created}::timestamptz, ${after.id}::uuid)` : undefined,
    ))
    .orderBy(asc(foodLog.date), asc(foodLog.createdAt), asc(foodLog.id)).limit(pageSize);
}

function scanPage(userId: string, after: ScanCursor | null, pageSize: number) {
  return db.select({
    id: scan.id, created: createdText(scan.createdAt), createdAt: scan.createdAt, inputKind: scan.inputKind, status: scan.status,
    result: scan.result, confidence: scan.confidence, barcode: scan.barcode, errorCode: scan.errorCode,
  }).from(scan)
    .where(and(
      eq(scan.userId, userId), isNull(scan.deletedAt),
      after ? sql`(${scan.createdAt}, ${scan.id}) > (${after.created}::timestamptz, ${after.id}::uuid)` : undefined,
    ))
    .orderBy(asc(scan.createdAt), asc(scan.id)).limit(pageSize);
}

async function* diaryPages(userId: string, tz: string, pageSize: number): AsyncGenerator<DiaryRow[]> {
  let after: DiaryCursor | null = null;
  for (;;) {
    const rows = await diaryPage(userId, after, pageSize);
    yield rows.map(({ row: r }) => ({
      date: r.date, meal: r.meal, food: r.name, portion: r.portion.label, amount: r.portion.amount, grams: r1(r.portion.grams),
      energy_kcal: r1(r.nutrients.energyKcal), protein_g: r1(r.nutrients.protein), carbs_g: r1(r.nutrients.carbs), fat_g: r1(r.nutrients.fat),
      fibre_g: r1(r.nutrients.fibre), sugars_g: r1(r.nutrients.sugars), sat_fat_g: r1(r.nutrients.satFat), sodium_mg: r1(r.nutrients.sodiumMg),
      grade: r.grade, logged_at: localStamp(r.createdAt, tz),
    }));
    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1]!;
    after = { date: last.row.date, created: last.created, id: last.row.id };
  }
}

async function* scanPages(userId: string, tz: string, pageSize: number): AsyncGenerator<ScanRow[]> {
  let after: ScanCursor | null = null;
  for (;;) {
    const rows = await scanPage(userId, after, pageSize);
    yield rows.map((r) => ({
      scanned_at: localStamp(r.createdAt, tz), mode: r.inputKind, status: r.status, name: r.result?.name ?? null, brand: r.result?.brand ?? null,
      grade: r.result?.grade ?? null, confidence: r.confidence, barcode: r.barcode, basis: r.result?.basis ?? null,
      energy_kcal_per_100: r1(r.result?.per100?.energyKcal), error: r.errorCode,
    }));
    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1]!;
    after = { created: last.created, id: last.id };
  }
}

function stream<T>(what: ExportKind, userId: string, columns: CsvColumn<T>[], pages: AsyncGenerator<T[]>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    // A byte-order mark so Excel reads the UTF-8 (food names in Hindi, ₹ in brands) correctly.
    start(c) { c.enqueue(enc.encode(`﻿${csvLine(columns.map((col) => col.header))}`)); },
    async pull(c) {
      // Each pull answers the reader with one non-empty page, or closes: a last page that comes back
      // empty (the rows ended exactly on a page edge) mustn't leave the read waiting.
      for (;;) {
        let next: IteratorResult<T[]>;
        try {
          next = await pages.next();
        } catch (err) {
          // The 200 and headers are already sent, so the download just stops: log it (the user's id, no other PII).
          console.error(`export ${what} failed mid-stream for user ${userId}`, err);
          throw err;
        }
        if (next.done) return c.close();
        if (next.value.length) return c.enqueue(enc.encode(next.value.map((r) => csvLine(columns.map((col) => r[col.key]))).join("")));
      }
    },
    async cancel() { await pages.return(undefined); },
    // Fetch a page only when the reader asks for one (no read-ahead): memory stays at one page.
  }, { highWaterMark: 0 });
}

/**
 * The CSV stream for `what`, timestamps on `tz`'s clock, or null when that export isn't built yet
 * (workouts, weight: Task 3). `pageSize` is for tests.
 */
export function exportCsv(userId: string, what: ExportKind, tz: string, pageSize = PAGE): ReadableStream<Uint8Array> | null {
  switch (what) {
    case "diary": return stream(what, userId, DIARY_COLUMNS, diaryPages(userId, tz, pageSize));
    case "scans": return stream(what, userId, SCAN_COLUMNS, scanPages(userId, tz, pageSize));
    // Phase 2 Task 3 adds the workout and weight tables; until then the route answers 400 "not available yet".
    case "workouts":
    case "weight":
      return null;
  }
}
