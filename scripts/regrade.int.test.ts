import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createUser, resetDb, testDb } from "@/tests/helpers/db";
import { db } from "@/lib/db/client";
import { food, scan } from "@/lib/db/schema";
import { createCustomFoodFromScan } from "@/lib/foods/service";
import { upsertFoods } from "@/lib/foods/insert";
import { toFoodDraft } from "@/lib/foods/seed-map";
import type { ScanResult } from "@/lib/engine/result";
import { staleFoodsQuery } from "./regrade";

const STALE_VERSION = "0000.00-stale"; // simulates a GRADE_VERSION bump: never equal to the real constant

async function markStale(foodId: string) {
  await testDb().update(food).set({ gradeVersion: STALE_VERSION }).where(eq(food.id, foodId));
}

describe("staleFoodsQuery (regrade selection)", () => {
  beforeEach(resetDb);

  it("selects an ordinary food whose grade_version fell behind GRADE_VERSION", async () => {
    await upsertFoods([toFoodDraft({ source: "indb", sourceRef: "R1", name: "Dal tadka", basis: "per_100g",
      per100: { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5 }, portions: [], countries: ["IN"] }, [])]);
    const [row] = await db.select().from(food).where(eq(food.sourceRef, "R1"));
    await markStale(row!.id);

    const stale = await staleFoodsQuery(db);
    expect(stale.map((r) => r.id)).toContain(row!.id);
  });

  it("never selects a grade-frozen food (saved from a scan) even after a simulated GRADE_VERSION bump", async () => {
    const u = await createUser();
    const result: ScanResult = {
      kind: "meal", name: "Homemade khichdi bowl", brand: null, foodId: null, basis: "per_100g",
      per100: { energyKcal: 180, protein: 6, carbs: 30, fat: 4 },
      provenance: { energyKcal: "estimate", protein: "estimate", carbs: "estimate", fat: "estimate" },
      portions: [{ label: "1 bowl", amount: 1, unit: "serving", grams: 350 }],
      defaultPortion: 0, grade: "B", gradeValue: 72, components: [], reasons: [], flags: [],
      ingredients: [], alternatives: [], hints: [], confidence: "medium", inputKind: "meal",
    };
    const [s] = await db.insert(scan).values({ userId: u, status: "done", imageCount: 0, engineVersion: "test", result }).returning();
    const { food: saved } = await createCustomFoodFromScan(u, s!.id);
    expect(saved.gradeFrozen).toBe(true);
    await markStale(saved.id);

    const stale = await staleFoodsQuery(db);
    expect(stale.map((r) => r.id)).not.toContain(saved.id);
  });
});
