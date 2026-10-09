import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { bodyWeight, foodLog, scan, workout, workoutExercise, workoutSet } from "@/lib/db/schema";
import { exportCsv, localStamp } from "./service";

const portion = { label: "g", amount: 100, unit: "g" as const, grams: 100 };
const nutrients = { energyKcal: 100, protein: 1, carbs: 1, fat: 1 };
const logFood = (userId: string, name: string, date: string) => db.insert(foodLog).values({ userId, date, meal: "lunch", name, portion, nutrients });
const dec = new TextDecoder();

/** Reads the stream one chunk (= header, then one page) at a time, running `between(page)` after each page. */
async function readAll(stream: ReadableStream<Uint8Array>, between?: (page: number) => Promise<void>) {
  const reader = stream.getReader();
  let text = "";
  for (let page = 0; ; page++) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value);
    await between?.(page);
  }
  return text.replace(/^﻿/, "").split("\r\n").filter(Boolean).slice(1);
}

describe("exportCsv paging", () => {
  let userId = "";
  beforeEach(async () => {
    await resetDb();
    userId = await createUser();
  });
  afterEach(() => vi.restoreAllMocks());

  it("diary: rows written mid-export cause no duplicates or gaps across pages (keyset, not OFFSET)", async () => {
    for (const [i, d] of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].entries()) await logFood(userId, `food${i}`, d);
    const rows = await readAll(exportCsv(userId, "diary", "Asia/Kolkata", 2), async (page) => {
      // After the first page (chunk 1; chunk 0 is the header): a row sorting before the cursor, which
      // would shift every later OFFSET page by one, and one after it, which the export should still reach.
      if (page === 1) {
        await logFood(userId, "early", "2026-09-30");
        await logFood(userId, "late", "2026-10-06");
      }
    });
    const names = rows.map((r) => r.split(",")[2]);
    expect(names).toEqual(["food0", "food1", "food2", "food3", "food4", "late"]);
  });

  it("diary: rows on the same date keep their order and none repeat at a page edge", async () => {
    for (let i = 0; i < 7; i++) await logFood(userId, `same${i}`, "2026-10-01");
    const names = (await readAll(exportCsv(userId, "diary", "Asia/Kolkata", 3))).map((r) => r.split(",")[2]);
    expect(names).toEqual(["same0", "same1", "same2", "same3", "same4", "same5", "same6"]);
  });

  it("scans: pages by (created_at, id), with a mid-export insert neither repeated nor skipping rows", async () => {
    const base = { userId, status: "failed" as const, inputKind: "label" as const, engineVersion: "t" };
    for (let i = 0; i < 5; i++) await db.insert(scan).values({ ...base, errorCode: `E${i}`, createdAt: new Date(Date.UTC(2026, 9, 1, i)) });
    const rows = await readAll(exportCsv(userId, "scans", "UTC", 2), async (page) => {
      if (page === 1) await db.insert(scan).values({ ...base, errorCode: "EARLY", createdAt: new Date(Date.UTC(2026, 8, 1)) });
    });
    expect(rows.map((r) => r.split(",").at(-1))).toEqual(["E0", "E1", "E2", "E3", "E4"]);
  });

  it("workouts: pages by (date, started_at, id) without splitting a workout's sets; a mid-export insert neither repeats nor skips", async () => {
    const basis = { met: 3.5, weightKg: 70, estimated: true, minutes: 30 };
    const addWorkout = async (title: string, date: string, sets = 0) => {
      const [w] = await db.insert(workout).values({ userId, date, kind: "gym", title, intensity: "moderate", startedAt: new Date(`${date}T06:00:00Z`), durationMin: 30, kcalBurned: 123, kcalBasis: basis }).returning();
      if (sets) {
        const [e] = await db.insert(workoutExercise).values({ workoutId: w!.id, position: 0, exerciseKey: "squat", name: "Squat" }).returning();
        await db.insert(workoutSet).values(Array.from({ length: sets }, (_, position) => ({ exerciseId: e!.id, position, weightKg: 100, reps: 5, done: true })));
      }
    };
    for (const [i, d] of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].entries()) await addWorkout(`w${i}`, d, i === 1 ? 3 : 0);
    const rows = await readAll(exportCsv(userId, "workouts", "UTC", 2), async (page) => {
      if (page === 1) {
        await addWorkout("early", "2026-09-30");
        await addWorkout("late", "2026-10-05");
      }
    });
    expect(rows.map((r) => r.split(",")[2])).toEqual(["w0", "w1", "w1", "w1", "w2", "w3", "late"]);
  });

  it("weight: pages by date", async () => {
    for (let d = 1; d <= 5; d++) await db.insert(bodyWeight).values({ userId, date: `2026-10-0${d}`, kg: 70 + d });
    const rows = await readAll(exportCsv(userId, "weight", "UTC", 2));
    expect(rows.map((r) => r.split(",").slice(0, 2).join(","))).toEqual(["2026-10-01,71", "2026-10-02,72", "2026-10-03,73", "2026-10-04,74", "2026-10-05,75"]);
  });

  it("logs a mid-stream failure with the kind and user id, then errors the stream", async () => {
    for (let i = 0; i < 3; i++) await logFood(userId, `f${i}`, "2026-10-01");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const stream = exportCsv(userId, "diary", "UTC", 2);
    const reader = stream.getReader();
    await reader.read(); // header
    await reader.read(); // page 1
    // db is a lazy Proxy; spy on the real instance behind it.
    const real = (globalThis as unknown as { __db: typeof db }).__db;
    vi.spyOn(real, "select").mockImplementation(() => { throw new Error("db down"); });
    await expect(reader.read()).rejects.toThrow("db down");
    expect(log).toHaveBeenCalledWith(`export diary failed mid-stream for user ${userId}`, expect.any(Error));
  });
});

describe("localStamp", () => {
  it("formats on the given clock as YYYY-MM-DD HH:mm (24 h)", () => {
    const d = new Date("2026-10-01T19:30:00Z");
    expect(localStamp(d, "Asia/Kolkata")).toBe("2026-10-02 01:00");
    expect(localStamp(d, "UTC")).toBe("2026-10-01 19:30");
    expect(localStamp(new Date("2026-10-01T18:30:00Z"), "Asia/Kolkata")).toBe("2026-10-02 00:00");
  });
});
