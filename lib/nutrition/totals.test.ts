import { describe, expect, it } from "vitest";
import { dayTotals, sumNutrients } from "./totals";
import type { DailyTargets } from "./types";

const targets: DailyTargets = { energyKcal: 2000, protein: 60, carbs: 275, fat: 67, fibre: 30, sugarsMax: 50, sodiumMgMax: 1500, satFatMax: 22 };

describe("sumNutrients", () => {
  it("treats missing optional values as zero", () => {
    const s = sumNutrients([{ energyKcal: 100, protein: 1, carbs: 2, fat: 3 }, { energyKcal: 50, protein: 1, carbs: 1, fat: 1, sodiumMg: 200 }]);
    expect(s.energyKcal).toBe(150);
    expect(s.sodiumMg).toBe(200);
    expect(s.fibre).toBe(0);
  });
});

describe("dayTotals", () => {
  const entries = [
    { meal: "breakfast" as const, nutrients: { energyKcal: 290, protein: 6, carbs: 50, fat: 7.5, sodiumMg: 500 } },
    { meal: "snack" as const, nutrients: { energyKcal: 168, protein: 3.3, carbs: 12.6, fat: 11.4, sodiumMg: 1100, sugars: 0.6 } },
  ];
  const t = dayTotals(entries, targets);
  it("groups by meal including empty meals", () => {
    expect(t.byMeal.breakfast.energyKcal).toBe(290);
    expect(t.byMeal.dinner.energyKcal).toBe(0);
  });
  it("reports remaining for aim targets", () => {
    const kcal = t.progress.find((p) => p.key === "energyKcal")!;
    expect(kcal).toMatchObject({ kind: "aim", total: 458, remaining: 1542, overBy: 0 });
  });
  it("reports over-by for limit targets", () => {
    const sodium = t.progress.find((p) => p.key === "sodiumMgMax")!;
    expect(sodium).toMatchObject({ kind: "limit", total: 1600, target: 1500, remaining: 0, overBy: 100 });
  });
});
