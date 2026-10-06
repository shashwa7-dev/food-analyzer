import { describe, expect, it } from "vitest";
import { dishScore } from "./dish";

describe("dishScore", () => {
  it("a katori of dal tadka is A", () => {
    expect(dishScore({ energyKcal: 180, protein: 9, carbs: 21, fat: 6.75, fibre: 5.25, sugars: 2.25, satFat: 1.65, sodiumMg: 420 }).grade).toBe("A");
  });
  it("a katori of paneer butter masala is C or worse", () => {
    const r = dishScore({ energyKcal: 345, protein: 12, carbs: 12, fat: 28.5, fibre: 2.25, sugars: 6, satFat: 15, sodiumMg: 630 });
    expect(["C", "D", "E"]).toContain(r.grade);
    expect(r.components.find((c) => c.key === "satFat")!.points).toBeGreaterThan(0);
  });
  it("clamps to 0–100", () => {
    const r = dishScore({ energyKcal: 2000, protein: 0, carbs: 200, fat: 120, sugars: 120, satFat: 60, sodiumMg: 6000 });
    expect(r.value).toBe(0);
    expect(r.grade).toBe("E");
  });
});
