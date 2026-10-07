import { describe, expect, it } from "vitest";
import { ensureBasePortion, nutrientsFor, rescaleEntry, scaleNutrients } from "./portions";

const dal = { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, fibre: 3.5, sodiumMg: 280 };

describe("nutrientsFor", () => {
  it("scales per-100 values to grams", () => {
    expect(nutrientsFor(dal, 150)).toEqual({ energyKcal: 180, protein: 9, carbs: 21, fat: 6.75, fibre: 5.25, sodiumMg: 420 });
  });
  it("keeps optional keys absent when missing", () => {
    expect("sugars" in nutrientsFor(dal, 100)).toBe(false);
  });
  it("rejects non-positive grams", () => {
    expect(() => nutrientsFor(dal, 0)).toThrow();
  });
});

describe("ensureBasePortion", () => {
  it("adds 100 g when missing and dedupes labels", () => {
    const p = ensureBasePortion("per_100g", [
      { label: "1 katori", amount: 1, unit: "household", grams: 150 },
      { label: "1 katori", amount: 1, unit: "household", grams: 150 },
    ]);
    expect(p.map((x) => x.label)).toEqual(["1 katori", "100 g"]);
  });
  it("uses ml for liquids", () => {
    expect(ensureBasePortion("per_100ml", []).at(-1)).toEqual({ label: "100 ml", amount: 100, unit: "ml", grams: 100 });
  });
});

describe("rescaleEntry", () => {
  const old = { portion: { label: "1 katori", amount: 1, unit: "household" as const, grams: 150 }, nutrients: nutrientsFor(dal, 150) };
  it("rescales by grams when both are known", () => {
    expect(rescaleEntry(old, { label: "2 katori", amount: 2, unit: "household", grams: 300 })?.energyKcal).toBe(360);
  });
  it("rescales by amount when grams are unknown but the unit and label match", () => {
    const quick = { portion: { label: "1 serving", amount: 1, unit: "serving" as const, grams: null }, nutrients: { energyKcal: 350, protein: 14, carbs: 48, fat: 10 } };
    expect(rescaleEntry(quick, { label: "1 serving", amount: 2, unit: "serving", grams: null })?.energyKcal).toBe(700);
  });
  it("returns null when it can't rescale", () => {
    const quick = { portion: { label: "1 serving", amount: 1, unit: "serving" as const, grams: null }, nutrients: { energyKcal: 350, protein: 14, carbs: 48, fat: 10 } };
    expect(rescaleEntry(quick, { label: "100 g", amount: 100, unit: "g", grams: 100 })).toBeNull();
  });
  it("scaleNutrients multiplies every present key", () => {
    expect(scaleNutrients({ energyKcal: 10, protein: 1, carbs: 2, fat: 3 }, 2)).toEqual({ energyKcal: 20, protein: 2, carbs: 4, fat: 6 });
  });
});
