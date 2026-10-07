import { describe, expect, it } from "vitest";
import { customNutrientIssues } from "./custom-validate";

const base = { energyKcal: 120, protein: 4, carbs: 20, fat: 3 };
const per100g = { amount: 100, unit: "g" as const };

describe("customNutrientIssues", () => {
  it("passes plausible numbers", () => {
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, sugars: 5, satFat: 1, sodiumMg: 400 } })).toEqual([]);
  });

  it("flags a part bigger than its whole, under that field", () => {
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, sugars: 30 } })).toEqual([{ field: "sugars", message: "Sugars can't be more than carbs." }]);
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, satFat: 5 } })).toEqual([{ field: "satFat", message: "Saturated fat can't be more than fat." }]);
  });

  it("flags a per-100 value past the bound", () => {
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, sodiumMg: 45_000 } })).toEqual([{ field: "sodiumMg", message: "Sodium can't be more than 40,000 mg per 100 g." }]);
    expect(customNutrientIssues({ per: { amount: 100, unit: "ml" }, nutrients: { ...base, energyKcal: 1200 } })[0]).toEqual({ field: "energyKcal", message: "Calories can't be more than 910 kcal per 100 ml." });
  });

  it("scales a weighed serving to per 100 g, and says to check the serving size", () => {
    // 20 g protein in a 10 g serving is 200 g per 100 g.
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, servingGrams: 10, nutrients: { energyKcal: 80, protein: 20, carbs: 0, fat: 0 } }))
      .toEqual([{ field: "protein", message: "Protein works out to more than 100 g per 100 g. Check the serving size." }]);
    // The same numbers in a 30 g serving are fine.
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, servingGrams: 30, nutrients: { energyKcal: 80, protein: 20, carbs: 0, fat: 0 } })).toEqual([]);
  });

  it("checks a serving of unknown weight against the per-100 bounds it's stored under, and asks for its weight (review M5)", () => {
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, nutrients: { energyKcal: 800, protein: 30, carbs: 90, fat: 35, sodiumMg: 3000 } })).toEqual([]);
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, nutrients: { ...base, sugars: 40 } })).toEqual([{ field: "sugars", message: "Sugars can't be more than carbs." }]);
    // A 1 L soda: 106 g sugars a serving would be stored as 106 g per 100 g and dropped on read.
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, nutrients: { energyKcal: 420, protein: 0, carbs: 106, fat: 0, sugars: 106 } }))
      .toEqual([
        { field: "carbs", message: "Carbs can't be more than 100 g per serving without its weight. Add the serving size." },
        { field: "sugars", message: "Sugars can't be more than 100 g per serving without its weight. Add the serving size." },
      ]);
  });

  it("checks the vitamins and minerals against their bounds, in their own units", () => {
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, ironMg: 4, vitaminB12Ug: 1.2, calciumMg: 300 } })).toEqual([]);
    // Mango pickle with 2,000 mg iron: a label's mg keyed in as g.
    expect(customNutrientIssues({ per: per100g, nutrients: { ...base, ironMg: 2000 } })).toEqual([{ field: "ironMg", message: "Iron can't be more than 150 mg per 100 g." }]);
    // 40 µg vitamin D in a 20 g serving is 200 µg per 100 g.
    expect(customNutrientIssues({ per: { amount: 1, unit: "serving" }, servingGrams: 20, nutrients: { ...base, vitaminDUg: 40 } }))
      .toEqual([{ field: "vitaminDUg", message: "Vitamin D works out to more than 100 µg per 100 g. Check the serving size." }]);
  });
});
