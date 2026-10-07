import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/lib/db/client";
import { food, foodLog, scan, userFoodStats } from "@/lib/db/schema";
import { DateSchema } from "@/lib/dates";
import type { ScanResult } from "@/lib/engine/result";
import { InvalidError, NotFoundError } from "@/lib/errors";
import { getFoodForUser } from "@/lib/foods/service";
import { isFreeGramsPortion } from "@/lib/log/format";
import { nutrientsFor, rescaleEntry } from "@/lib/nutrition/portions";
import { targetsFor } from "@/lib/nutrition/targets";
import { dayTotals } from "@/lib/nutrition/totals";
import { MEALS, type Portion } from "@/lib/nutrition/types";
import { getProfile } from "@/lib/profile/service";
import { visibleScanWhere } from "@/lib/scans/service";

export type EntryRow = typeof foodLog.$inferSelect;
const Meal = z.enum(MEALS);
const NutrientsInput = z.object({
  energyKcal: z.number().min(0).max(5000), protein: z.number().min(0).max(500), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(500),
  fibre: z.number().min(0).max(500).optional(), sugars: z.number().min(0).max(500).optional(), satFat: z.number().min(0).max(500).optional(),
  sodiumMg: z.number().min(0).max(20000).optional(),
});
export const AddEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("food"), date: DateSchema, meal: Meal, foodId: z.uuid(), portionIndex: z.number().int().min(0).max(20), quantity: z.number().min(0.25).max(20) }),
  z.object({ kind: z.literal("grams"), date: DateSchema, meal: Meal, foodId: z.uuid(), grams: z.number().min(1).max(5000) }),
  z.object({ kind: z.literal("quick"), date: DateSchema, meal: Meal, name: z.string().trim().min(1).max(120), nutrients: NutrientsInput }),
  z.object({ kind: z.literal("scan"), date: DateSchema, meal: Meal, scanId: z.uuid(), portionIndex: z.number().int().min(0).max(20), quantity: z.number().min(0.25).max(20) }),
  z.object({ kind: z.literal("scan_grams"), date: DateSchema, meal: Meal, scanId: z.uuid(), grams: z.number().min(1).max(5000) }),
]);
export type AddEntryInput = z.infer<typeof AddEntrySchema>;
// quantity multiplies a labelled portion; grams replaces the weight of a free-grams entry (label "g"/"ml").
export const UpdateEntrySchema = z.object({
  meal: Meal.optional(), date: DateSchema.optional(), quantity: z.number().min(0.25).max(20).optional(), grams: z.number().min(1).max(5000).optional(),
});

// Shared by food/grams portions (from a food row) and scan/scan_grams portions (from a scan result):
// same labelled-portion × quantity scaling and the same 1-5000 g range check either way.
function resolvePortion(portions: Portion[], basis: "per_100g" | "per_100ml", sel: { grams: number } | { portionIndex: number; quantity: number }): Portion {
  if ("grams" in sel) {
    const unit = basis === "per_100ml" ? "ml" : "g";
    return { label: unit, amount: sel.grams, unit, grams: sel.grams };
  }
  const base = portions[sel.portionIndex];
  if (!base) throw new InvalidError("Unknown portion.");
  if (!base.grams) throw new InvalidError("This portion has no known weight. Choose grams instead.");
  const g = Math.round(base.grams * sel.quantity * 10) / 10;
  if (g < 1 || g > 5000) throw new InvalidError("Portion is out of range.");
  return { label: base.label, amount: sel.quantity, unit: base.unit, grams: g };
}

async function bumpFoodStats(tx: Tx, userId: string, foodId: string): Promise<void> {
  await tx.insert(userFoodStats).values({ userId, foodId, uses: 1, lastUsedAt: new Date() })
    .onConflictDoUpdate({ target: [userFoodStats.userId, userFoodStats.foodId], set: { uses: sql`${userFoodStats.uses} + 1`, lastUsedAt: new Date() } });
  await tx.update(food).set({ popularity: sql`${food.popularity} + 1` }).where(eq(food.id, foodId));
}

export async function addEntry(userId: string, raw: AddEntryInput): Promise<EntryRow> {
  const input = AddEntrySchema.parse(raw);
  if (input.kind === "quick") {
    const portion: Portion = { label: "1 serving", amount: 1, unit: "serving", grams: null };
    const [row] = await db.insert(foodLog).values({ userId, date: input.date, meal: input.meal, name: input.name, portion, nutrients: input.nutrients }).returning();
    return row!;
  }
  if (input.kind === "scan" || input.kind === "scan_grams") return addScanEntry(userId, input);

  const f = await getFoodForUser(userId, input.foodId);
  if (!f) throw new NotFoundError();
  const portion = input.kind === "grams"
    ? resolvePortion(f.portions, f.basis, { grams: input.grams })
    : resolvePortion(f.portions, f.basis, { portionIndex: input.portionIndex, quantity: input.quantity });
  const grams = portion.grams!;
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(foodLog).values({ userId, date: input.date, meal: input.meal, foodId: f.id, name: f.brand ? `${f.name} · ${f.brand}` : f.name, portion, nutrients: nutrientsFor(f.per100, grams), grade: f.grade }).returning();
    await bumpFoodStats(tx, userId, f.id);
    return row!;
  });
}

/**
 * Logging from a scan (Task 9 brief amendments): portion grams always come from the scan's own
 * `result.portions[portionIndex]` / `result.basis` — never from the linked food's portions, which can
 * differ (e.g. the scan saw "1 bowl ~200 g" while the catalogue food's own portion is "1 katori 150 g").
 * `result.foodId`, when it is still visible to this user, is used only to set `food_log.foodId` and to
 * bump recents/popularity for that food — exactly like logging that food directly. Name and grade are
 * always a snapshot of the result, never the linked food's current values. `food_log.scanId` is always
 * set, so a scan-logged entry is traceable to its scan regardless of whether a food got linked.
 */
async function addScanEntry(userId: string, input: Extract<AddEntryInput, { kind: "scan" | "scan_grams" }>): Promise<EntryRow> {
  const [row] = await db.select({ status: scan.status, result: scan.result }).from(scan).where(and(eq(scan.id, input.scanId), visibleScanWhere(userId)));
  if (!row || row.status !== "done" || !row.result) throw new NotFoundError();
  const result: ScanResult = row.result;

  const portion = input.kind === "scan_grams"
    ? resolvePortion(result.portions, result.basis, { grams: input.grams })
    : resolvePortion(result.portions, result.basis, { portionIndex: input.portionIndex, quantity: input.quantity });
  const grams = portion.grams!;
  const name = result.brand ? `${result.name} · ${result.brand}` : result.name;
  const nutrients = nutrientsFor(result.per100, grams);
  const linkedFood = result.foodId ? await getFoodForUser(userId, result.foodId) : null;

  return db.transaction(async (tx) => {
    const [entry] = await tx.insert(foodLog).values({
      userId, date: input.date, meal: input.meal, scanId: input.scanId, foodId: linkedFood?.id ?? null,
      name, portion, nutrients, grade: result.grade,
    }).returning();
    if (linkedFood) await bumpFoodStats(tx, userId, linkedFood.id);
    return entry!;
  });
}

export async function getDay(userId: string, date: string) {
  const prof = await getProfile(userId);
  const targets = targetsFor(prof.goal, prof.targets);
  const entries = await db.select().from(foodLog).where(and(eq(foodLog.userId, userId), eq(foodLog.date, date))).orderBy(asc(foodLog.createdAt));
  return { date, entries, targets, ...dayTotals(entries.map((e) => ({ meal: e.meal, nutrients: e.nutrients })), targets) };
}

export async function updateEntry(userId: string, id: string, raw: z.infer<typeof UpdateEntrySchema>): Promise<EntryRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const patch = UpdateEntrySchema.parse(raw);
  const [cur] = await db.select().from(foodLog).where(and(eq(foodLog.id, id), eq(foodLog.userId, userId)));
  if (!cur) return null;
  let portion = cur.portion, nutrients = cur.nutrients;
  const freeGrams = isFreeGramsPortion(cur.portion);
  if (patch.grams !== undefined && !freeGrams) throw new InvalidError("Change the quantity instead.");
  if (patch.quantity !== undefined && freeGrams) throw new InvalidError("Change the grams instead.");
  let next: Portion | null = null;
  if (patch.grams !== undefined && patch.grams !== cur.portion.grams) {
    const g = Math.round(patch.grams * 10) / 10;
    next = { ...cur.portion, amount: g, grams: g };
  } else if (patch.quantity !== undefined && patch.quantity !== cur.portion.amount) {
    const perUnit = cur.portion.grams ? cur.portion.grams / cur.portion.amount : null;
    const nextGrams = perUnit ? Math.round(perUnit * patch.quantity * 10) / 10 : null;
    if (nextGrams !== null && (nextGrams < 1 || nextGrams > 5000)) throw new InvalidError("Portion is out of range.");
    next = { ...cur.portion, amount: patch.quantity, grams: nextGrams };
  }
  if (next) {
    const scaled = rescaleEntry({ portion: cur.portion, nutrients: cur.nutrients }, next);
    if (!scaled) throw new InvalidError("Can't change this portion.");
    if (!NutrientsInput.safeParse(scaled).success) throw new InvalidError("Portion is out of range.");
    portion = next; nutrients = scaled;
  }
  const [row] = await db.update(foodLog).set({ meal: patch.meal ?? cur.meal, date: patch.date ?? cur.date, portion, nutrients, updatedAt: new Date() })
    .where(and(eq(foodLog.id, id), eq(foodLog.userId, userId))).returning();
  return row ?? null;
}

export async function deleteEntry(userId: string, id: string): Promise<boolean> {
  if (!z.uuid().safeParse(id).success) return false;
  const rows = await db.delete(foodLog).where(and(eq(foodLog.id, id), eq(foodLog.userId, userId))).returning({ id: foodLog.id });
  return rows.length === 1;
}
