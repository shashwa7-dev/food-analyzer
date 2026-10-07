import { describe, expect, it } from "vitest";
import { nutriScore, pointsFor } from "./packaged";

describe("pointsFor", () => {
  it("counts thresholds strictly exceeded", () => {
    expect(pointsFor(0, [1, 2, 3])).toBe(0);
    expect(pointsFor(1, [1, 2, 3])).toBe(0);
    expect(pointsFor(1.01, [1, 2, 3])).toBe(1);
    expect(pointsFor(99, [1, 2, 3])).toBe(3);
  });
});

describe("nutriScore general", () => {
  it("grades a salty fried snack E", () => {
    // aloo bhujia-like: 560 kcal, sugars 2, sat fat 11, sodium 1050 mg, protein 11, fibre 4
    const r = nutriScore({ category: "general", per100: { energyKcal: 560, protein: 11, carbs: 42, fat: 38, sugars: 2, satFat: 11, sodiumMg: 1050, fibre: 4 } });
    // energy 2343 kJ → 6; sugars 2 → 0; satFat 11 → 10; salt 2.625 g → 13; N = 29 ≥ 11 → protein not counted; fibre 4 → 1; P = 1; score 28
    expect(r.grade).toBe("E");
    expect(r.components.find((c) => c.key === "protein")?.points).toBe(0);
  });
  it("grades roasted chana A", () => {
    const r = nutriScore({ category: "general", per100: { energyKcal: 370, protein: 19, carbs: 58, fat: 6, sugars: 8, satFat: 0.7, sodiumMg: 25, fibre: 17 } });
    // energy 1548 kJ → 4; sugars 8 → 2; satFat 0.7 → 0; salt 0.0625 → 0; N = 6; protein 19 → 7; fibre 17 → 5; score −6
    expect(r.grade).toBe("A");
    expect(r.value).toBeGreaterThanOrEqual(80);
  });
  it("downgrades ultra-processed foods by one grade at most", () => {
    const base = { category: "general" as const, per100: { energyKcal: 370, protein: 19, carbs: 58, fat: 6, sugars: 8, satFat: 0.7, sodiumMg: 25, fibre: 17 } };
    expect(nutriScore({ ...base, nova: 4 }).grade).toBe("B");
    expect(nutriScore({ ...base, additives: ["e621", "e627", "e631"] }).grade).toBe("B");
  });
  it("marks fruit/veg as estimated when not supplied", () => {
    const r = nutriScore({ category: "general", per100: { energyKcal: 100, protein: 1, carbs: 20, fat: 1 } });
    expect(r.components.find((c) => c.key === "fvl")?.estimated).toBe(true);
  });
  it("marks fats and cheese as approximate (general table in v1)", () => {
    const r = nutriScore({ category: "fat_oil", per100: { energyKcal: 900, protein: 0, carbs: 0, fat: 100, satFat: 60, sodiumMg: 0 } });
    expect(r.components.every((c) => c.approximate)).toBe(true);
  });
});

describe("nutriScore beverages", () => {
  it("water is always A", () => {
    expect(nutriScore({ category: "water", per100: { energyKcal: 0, protein: 0, carbs: 0, fat: 0 } }).grade).toBe("A");
  });
  it("a sugary soft drink is E", () => {
    // 42 kcal/100 ml, sugars 10.6 g
    const r = nutriScore({ category: "beverage", per100: { energyKcal: 42, protein: 0, carbs: 10.6, fat: 0, sugars: 10.6, sodiumMg: 10 } });
    // energy 176 kJ → 3; sugars 10.6 → 9; N = 12 → E (≥ 10)
    expect(r.grade).toBe("E");
  });
  it("unsweetened milk-coffee is not D or E", () => {
    const r = nutriScore({ category: "beverage", per100: { energyKcal: 45, protein: 2.3, carbs: 4.5, fat: 1.9, sugars: 4.4, satFat: 1.1, sodiumMg: 35 } });
    expect(["A", "B", "C"]).toContain(r.grade);
  });
});
