import { describe, expect, it } from "vitest";
import { scaleNutrients } from "../portions";
import type { Nutrients } from "../types";
import { dishScore } from "./dish";

// dishScore takes the reference portion and the per-100 g values; derive per100 from the portion in these cases.
const score = (portion: Nutrients, grams: number) => dishScore(portion, scaleNutrients(portion, 100 / grams));

describe("dishScore", () => {
  it("a katori of dal tadka is A", () => {
    expect(score({ energyKcal: 180, protein: 9, carbs: 21, fat: 6.75, fibre: 5.25, sugars: 2.25, satFat: 1.65, sodiumMg: 420 }, 150).grade).toBe("A");
  });
  it("a katori of paneer butter masala is C or worse", () => {
    const r = score({ energyKcal: 345, protein: 12, carbs: 12, fat: 28.5, fibre: 2.25, sugars: 6, satFat: 15, sodiumMg: 630 }, 150);
    expect(["C", "D", "E"]).toContain(r.grade);
    expect(r.components.find((c) => c.key === "satFat")!.points).toBeGreaterThan(0);
  });
  it("clamps to 0–100", () => {
    const r = score({ energyKcal: 2000, protein: 0, carbs: 200, fat: 120, sugars: 120, satFat: 60, sodiumMg: 6000 }, 400);
    expect(r.value).toBe(0);
    expect(r.grade).toBe("E");
  });
  it("a small piece of chikki is not A (sugar and energy density)", () => {
    const per100: Nutrients = { energyKcal: 520, protein: 12, carbs: 60, fat: 25, sugars: 44 };
    const r = dishScore(scaleNutrients(per100, 0.3), per100);
    expect(r.grade).not.toBe("A");
    expect(r.components.find((c) => c.key === "sugarsDensity")!.points).toBe(20);
    expect(r.components.find((c) => c.key === "energyDensity")!.points).toBeGreaterThan(0);
  });
  it("a slice of salty cheese pizza is not A (sodium density)", () => {
    const per100: Nutrients = { energyKcal: 266, protein: 11.4, carbs: 33.3, fat: 9.7, fibre: 2.3, sugars: 3.6, satFat: 4.5, sodiumMg: 540 };
    expect(dishScore(per100, per100).grade).not.toBe("A");
  });
  it("a 60 g samosa is not A (fat density)", () => {
    const per100: Nutrients = { energyKcal: 300, protein: 5, carbs: 30, fat: 18, sodiumMg: 450 };
    expect(dishScore(scaleNutrients(per100, 0.6), per100).grade).not.toBe("A");
  });
});
