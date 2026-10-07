import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb } from "@/tests/helpers/db";
import { upsertFoods } from "@/lib/foods/insert";
import { parseHouseholdCsv, toFoodDraft } from "@/lib/foods/seed-map";
import { createCustomFood, deleteCustomFood } from "@/lib/foods/service";
import { db } from "@/lib/db/client";
import { food, scan } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ScanResult } from "@/lib/engine/result";
import { addEntry, deleteEntry, getDay, loggedDates, updateEntry } from "./service";
import { InvalidError, NotFoundError } from "@/lib/errors";
import { addDays } from "@/lib/dates";

const today = new Date().toISOString().slice(0, 10);

function scanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    kind: "packaged", name: "Aloo Bhujia", brand: "Shree Rama", foodId: null, basis: "per_100g",
    per100: { energyKcal: 550, protein: 10, carbs: 50, fat: 35 },
    provenance: { energyKcal: "label", protein: "label", carbs: "label", fat: "label" },
    portions: [{ label: "1 pack", amount: 1, unit: "pack", grams: 50 }, { label: "100 g", amount: 100, unit: "g", grams: 100 }],
    defaultPortion: 0, grade: "D", gradeValue: 40, components: [], reasons: [], flags: [], ingredients: [],
    alternatives: [], hints: [], confidence: "high", inputKind: "barcode",
    ...overrides,
  };
}

async function insertScan(userId: string, opts: { status?: "queued" | "processing" | "done" | "failed"; result?: ScanResult | null; deletedAt?: Date | null } = {}) {
  const [row] = await db.insert(scan).values({
    userId, status: opts.status ?? "done", imageCount: 0, engineVersion: "test",
    result: "result" in opts ? opts.result : scanResult(), deletedAt: opts.deletedAt ?? null,
  }).returning();
  return row!;
}

async function dal() {
  await upsertFoods([toFoodDraft({ source: "indb", sourceRef: "D1", name: "Dal tadka", basis: "per_100g",
    per100: { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, fibre: 3.5, sugars: 1.5, satFat: 1.1, sodiumMg: 280 }, portions: [], countries: ["IN"] },
    parseHouseholdCsv("keyword,label,grams\ndal,1 katori,150\n"))]);
  const [row] = await db.select().from(food).where(eq(food.sourceRef, "D1"));
  return row!;
}

describe("food log", () => {
  beforeEach(resetDb);

  it("adds a food entry with server-computed nutrients and a grade snapshot", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 2 });
    expect(e.portion).toMatchObject({ label: "1 katori", amount: 2, grams: 300 });
    expect(e.nutrients.energyKcal).toBe(360);
    expect(e.grade).toBe(f.grade);
  });

  it("grade snapshot doesn't change with quantity", async () => {
    const u = await createUser(); const f = await dal();
    const a = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 0.5 });
    const b = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 2 });
    expect(a.grade).toBe(b.grade);
  });

  it("returns day totals by meal", async () => {
    const u = await createUser(); const f = await dal();
    await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 1 });
    await addEntry(u, { kind: "quick", date: today, meal: "snack", name: "Biscuits", nutrients: { energyKcal: 140, protein: 2, carbs: 20, fat: 6 } });
    const d = await getDay(u, today);
    expect(d.totals.energyKcal).toBe(320);
    expect(d.byMeal.snack.energyKcal).toBe(140);
    expect(d.entries).toHaveLength(2);
  });

  it("rejects another user's custom food with NotFound", async () => {
    const a = await createUser(); const b = await createUser();
    const mine = await createCustomFood(a, { name: "Secret laddoo", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 450, protein: 8, carbs: 55, fat: 22 } });
    await expect(addEntry(b, { kind: "food", date: today, meal: "snack", foodId: mine.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps working after the custom food is deleted", async () => {
    const a = await createUser();
    const f = await createCustomFood(a, { name: "Protein bar", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 380, protein: 30, carbs: 40, fat: 12 } });
    const e = await addEntry(a, { kind: "food", date: today, meal: "snack", foodId: f.id, portionIndex: 0, quantity: 1 });
    await deleteCustomFood(a, f.id);
    expect((await getDay(a, today)).totals.energyKcal).toBe(380);
    expect((await updateEntry(a, e.id, { quantity: 2 }))?.nutrients.energyKcal).toBe(760);
  });

  it("scopes update and delete by user", async () => {
    const a = await createUser(); const b = await createUser();
    const e = await addEntry(a, { kind: "quick", date: today, meal: "snack", name: "Chai", nutrients: { energyKcal: 105, protein: 3, carbs: 15, fat: 3.3 } });
    expect(await updateEntry(b, e.id, { quantity: 2 })).toBeNull();
    expect(await deleteEntry(b, e.id)).toBe(false);
    expect(await deleteEntry(a, e.id)).toBe(true);
  });

  it("logs free grams", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "grams", date: today, meal: "dinner", foodId: f.id, grams: 75 });
    expect(e.portion).toMatchObject({ label: "g", amount: 75, grams: 75 });
    expect(e.nutrients.energyKcal).toBe(90);
  });

  it("edits free grams via the grams field", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "grams", date: today, meal: "dinner", foodId: f.id, grams: 75 });
    const r = await updateEntry(u, e.id, { grams: 150 });
    expect(r?.portion).toMatchObject({ label: "g", amount: 150, unit: "g", grams: 150 });
    expect(r?.nutrients.energyKcal).toBe(180);
  });

  it("rejects grams on a labelled portion", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 1 });
    await expect(updateEntry(u, e.id, { grams: 150 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("treats quantity on a 100 g base portion as a multiplier", async () => {
    const u = await createUser(); const f = await dal();
    const base = f.portions.findIndex((p) => p.label === "100 g");
    const e = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: base, quantity: 1.5 });
    expect(e.portion).toMatchObject({ label: "100 g", amount: 1.5, grams: 150 });
    expect((await updateEntry(u, e.id, { quantity: 2 }))?.portion).toMatchObject({ amount: 2, grams: 200 });
  });

  it("bumps recents", async () => {
    const u = await createUser(); const f = await dal();
    await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 1 });
    const { recentFoods } = await import("@/lib/foods/service");
    expect((await recentFoods(u))[0]?.id).toBe(f.id);
  });

  it("rejects a quantity edit that would push a weighed portion out of range", async () => {
    const a = await createUser();
    const f = await createCustomFood(a, { name: "Big batch", per: { amount: 1, unit: "serving" }, servingGrams: 2000, nutrients: { energyKcal: 500, protein: 20, carbs: 60, fat: 15 } });
    const e = await addEntry(a, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 1 });
    await expect(updateEntry(a, e.id, { quantity: 20 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects a quantity edit that would push free grams below 1 g", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "grams", date: today, meal: "dinner", foodId: f.id, grams: 75 });
    await expect(updateEntry(u, e.id, { quantity: 0.25 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects a quantity edit on a quick-add that would push nutrients out of range", async () => {
    const u = await createUser();
    const e = await addEntry(u, { kind: "quick", date: today, meal: "snack", name: "Cookie", nutrients: { energyKcal: 350, protein: 4, carbs: 40, fat: 15 } });
    await expect(updateEntry(u, e.id, { quantity: 20 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("still allows a valid quantity edit", async () => {
    const u = await createUser(); const f = await dal();
    const e = await addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 0, quantity: 1 });
    expect((await updateEntry(u, e.id, { quantity: 2 }))?.nutrients.energyKcal).toBe(360);
  });

  it("rejects adding an unknown portion index", async () => {
    const u = await createUser(); const f = await dal();
    await expect(addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: f.id, portionIndex: 5, quantity: 1 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects adding a portion with no known weight", async () => {
    await upsertFoods([toFoodDraft({ source: "indb", sourceRef: "NG1", name: "Mystery item", basis: "per_100g",
      per100: { energyKcal: 100, protein: 1, carbs: 1, fat: 1 }, portions: [{ label: "1 serving", amount: 1, unit: "serving", grams: null }], countries: ["IN"] }, [])]);
    const [row] = await db.select().from(food).where(eq(food.sourceRef, "NG1"));
    const u = await createUser();
    await expect(addEntry(u, { kind: "food", date: today, meal: "lunch", foodId: row!.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(InvalidError);
  });

  // --- logging from a scan (Task 9) -----------------------------------------------------------

  it("logs a barcode scan backed by a food: portion grams come from the result (not the food's own portions), foodId and the recents bump come from the linked food", async () => {
    const u = await createUser(); const f = await dal(); // f's own portion is "1 katori" = 150 g
    const s = await insertScan(u, { result: scanResult({
      foodId: f.id, name: "Dal tadka (scanned)", brand: null, per100: f.per100,
      portions: [{ label: "1 bowl", amount: 1, unit: "household", grams: 200 }], defaultPortion: 0,
    }) });
    const e = await addEntry(u, { kind: "scan", date: today, meal: "lunch", scanId: s.id, portionIndex: 0, quantity: 1 });
    expect(e.scanId).toBe(s.id);
    expect(e.foodId).toBe(f.id);
    expect(e.portion).toMatchObject({ label: "1 bowl", amount: 1, grams: 200 }); // the result's own portion, not the food's "1 katori" 150 g
    expect(e.name).toBe("Dal tadka (scanned)"); // snapshot from the result, not f.name
    expect(e.grade).toBe("D");
    expect(e.nutrients.energyKcal).toBe(240); // f.per100.energyKcal (120) * 200/100
    const { recentFoods } = await import("@/lib/foods/service");
    expect((await recentFoods(u))[0]?.id).toBe(f.id);
  });

  it("logs a meal scan as a snapshot with no linked food", async () => {
    const u = await createUser();
    const s = await insertScan(u, { result: scanResult({
      kind: "meal", inputKind: "meal", foodId: null, name: "Thali", brand: null, grade: "C",
      per100: { energyKcal: 200, protein: 8, carbs: 25, fat: 7 },
      portions: [{ label: "1 plate", amount: 1, unit: "serving", grams: 400 }], defaultPortion: 0,
    }) });
    const e = await addEntry(u, { kind: "scan", date: today, meal: "dinner", scanId: s.id, portionIndex: 0, quantity: 1 });
    expect(e.foodId).toBeNull();
    expect(e.scanId).toBe(s.id);
    expect(e.name).toBe("Thali");
    expect(e.grade).toBe("C");
    expect(e.nutrients.energyKcal).toBe(800);
  });

  it("logs scan_grams using the result's basis for the unit", async () => {
    const u = await createUser();
    const s = await insertScan(u, { result: scanResult({ basis: "per_100ml", per100: { energyKcal: 40, protein: 0, carbs: 10, fat: 0 } }) });
    const e = await addEntry(u, { kind: "scan_grams", date: today, meal: "snack", scanId: s.id, grams: 250 });
    expect(e.portion).toMatchObject({ label: "ml", amount: 250, unit: "ml", grams: 250 });
    expect(e.nutrients.energyKcal).toBe(100);
  });

  it("snapshots instead of linking when the scan's food is no longer visible to this user", async () => {
    const a = await createUser(); const b = await createUser();
    const theirs = await createCustomFood(b, { name: "Secret laddoo", per: { amount: 100, unit: "g" }, nutrients: { energyKcal: 450, protein: 8, carbs: 55, fat: 22 } });
    const s = await insertScan(a, { result: scanResult({ foodId: theirs.id, name: "Something", brand: null }) });
    const e = await addEntry(a, { kind: "scan", date: today, meal: "snack", scanId: s.id, portionIndex: 0, quantity: 1 });
    expect(e.foodId).toBeNull();
    expect(e.scanId).toBe(s.id);
    expect(e.name).toBe("Something");
  });

  it("rejects a scan portion with no known weight", async () => {
    const u = await createUser();
    const s = await insertScan(u, { result: scanResult({ portions: [{ label: "1 serving", amount: 1, unit: "serving", grams: null }], defaultPortion: 0 }) });
    await expect(addEntry(u, { kind: "scan", date: today, meal: "snack", scanId: s.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects logging another user's scan with NotFound", async () => {
    const a = await createUser(); const b = await createUser();
    const s = await insertScan(a);
    await expect(addEntry(b, { kind: "scan", date: today, meal: "snack", scanId: s.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects logging a deleted scan with NotFound", async () => {
    const u = await createUser();
    const s = await insertScan(u, { deletedAt: new Date() });
    await expect(addEntry(u, { kind: "scan", date: today, meal: "snack", scanId: s.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects logging a scan that isn't done yet", async () => {
    const u = await createUser();
    const s = await insertScan(u, { status: "queued", result: null });
    await expect(addEntry(u, { kind: "scan", date: today, meal: "snack", scanId: s.id, portionIndex: 0, quantity: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(addEntry(u, { kind: "scan_grams", date: today, meal: "snack", scanId: s.id, grams: 100 })).rejects.toBeInstanceOf(NotFoundError);
  });

  // --- logged dates for the date picker (C1 Task 3) --------------------------------------------

  it("lists distinct logged dates in a month, owner-scoped", async () => {
    const a = await createUser(); const b = await createUser();
    const chai = { energyKcal: 105, protein: 3, carbs: 15, fat: 3.3 };
    // A month about two months back, so every day in it is inside the allowed 365-day window.
    const month = addDays(today, -60).slice(0, 7);
    const before = addDays(`${month}-01`, -1).slice(0, 7);
    const quick = (u: string, date: string) => addEntry(u, { kind: "quick", date, meal: "snack", name: "Chai", nutrients: chai });
    await quick(a, `${month}-05`); await quick(a, `${month}-03`); await quick(a, `${month}-03`);
    await quick(b, `${month}-04`);
    expect(await loggedDates(a, month)).toEqual([`${month}-03`, `${month}-05`]);
    expect(await loggedDates(a, before)).toEqual([]);
    expect(await loggedDates(b, month)).toEqual([`${month}-04`]);
  });

  it("rejects a malformed month", async () => {
    const a = await createUser();
    await expect(loggedDates(a, "2026-13")).rejects.toBeInstanceOf(InvalidError);
    await expect(loggedDates(a, "2026-1")).rejects.toBeInstanceOf(InvalidError);
  });
});
