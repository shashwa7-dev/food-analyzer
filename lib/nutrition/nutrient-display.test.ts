import { describe, expect, it } from "vitest";
import { allNutrientRows, formatAmount, moreNutrientRows, vitaminMineralRows } from "./nutrient-display";

const paneer = { energyKcal: 289, protein: 14, carbs: 2, fat: 25, satFat: 15, sugars: 0, sodiumMg: 20, calciumMg: 480, ironMg: 0.6, vitaminAUg: 200 };

describe("nutrient cards", () => {
  it("lists only what the food holds, never a missing value as 0", () => {
    const rows = moreNutrientRows(paneer, paneer, "per_100g");
    expect(rows.map((r) => r.key)).toEqual(["sugars", "satFat", "sodiumMg"]);
    expect(rows.find((r) => r.key === "sugars")!.value).toBe(0); // a stored 0 g is a real value
  });

  it("bands the limit nutrients from per-100 values (FSA bands), drinks with their own", () => {
    const rows = moreNutrientRows(paneer, paneer, "per_100g");
    expect(Object.fromEntries(rows.map((r) => [r.key, r.level]))).toEqual({ sugars: "low", satFat: "high", sodiumMg: "low" });
    const cola = { energyKcal: 42, protein: 0, carbs: 10.6, fat: 0, sugars: 10.6 };
    expect(moreNutrientRows(cola, cola, "per_100g")[0]!.level).toBe("medium");
    expect(moreNutrientRows(cola, cola, "per_100ml")[0]!.level).toBe("medium");
    expect(moreNutrientRows({ ...cola, sugars: 12 }, { ...cola, sugars: 12 }, "per_100ml")[0]!.level).toBe("high");
  });

  it("gives no band without a per-100 value (a per-serving label)", () => {
    expect(moreNutrientRows(paneer, null, "per_100g").every((r) => r.level === undefined)).toBe(true);
  });

  it("sorts vitamins and minerals by share of the Daily Value", () => {
    const rows = vitaminMineralRows(paneer);
    expect(rows.map((r) => [r.key, r.dv])).toEqual([["calciumMg", 37], ["vitaminAUg", 22], ["ironMg", 3]]);
    expect(rows[0]).toMatchObject({ label: "Calcium", unit: "mg" });
    expect(vitaminMineralRows({ energyKcal: 1, protein: 0, carbs: 0, fat: 0 })).toEqual([]);
  });

  it("lists everything for the full table, energy and macros first", () => {
    expect(allNutrientRows(paneer).map((r) => r.key)).toEqual(["energyKcal", "protein", "carbs", "fat", "sugars", "satFat", "sodiumMg", "calciumMg", "ironMg", "vitaminAUg"]);
  });
});

describe("formatAmount", () => {
  it("reads naturally at every size", () => {
    expect(formatAmount(1250)).toBe("1,250");
    expect(formatAmount(14.2)).toBe("14");
    expect(formatAmount(2.44)).toBe("2.4");
    expect(formatAmount(0.456)).toBe("0.46");
    expect(formatAmount(0.032)).toBe("0.032");
    expect(formatAmount(0.004)).toBe("<0.01");
    expect(formatAmount(0)).toBe("0");
  });
});
