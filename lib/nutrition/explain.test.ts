import { describe, expect, it } from "vitest";
import { explain } from "./explain";
import { nutriScore } from "./grade/packaged";
import { PRESETS } from "./targets";

describe("explain", () => {
  it("leads with the biggest negative and caps at 3", () => {
    const per100 = { energyKcal: 560, protein: 11, carbs: 42, fat: 38, sugars: 2, satFat: 11, sodiumMg: 1050, fibre: 4 };
    const reasons = explain({ grade: nutriScore({ category: "general", per100 }), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.length).toBeLessThanOrEqual(3);
    expect(reasons[0]).toMatchObject({ tone: "bad" });
    expect(reasons[0]!.text).toMatch(/salt|sodium/i);
  });
  it("includes a positive reason for good foods", () => {
    const per100 = { energyKcal: 370, protein: 19, carbs: 58, fat: 6, sugars: 8, satFat: 0.7, sodiumMg: 25, fibre: 17 };
    const reasons = explain({ grade: nutriScore({ category: "general", per100 }), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.some((r) => r.tone === "good" && /protein|fibre/i.test(r.text))).toBe(true);
  });
  it("returns an honest note for ungraded foods", () => {
    expect(explain({ grade: { grade: null, value: null, components: [] }, per100: { energyKcal: 900, protein: 0, carbs: 0, fat: 100 }, basis: "per_100g", targets: PRESETS.general }))
      .toEqual([{ tone: "warn", text: "Cooking ingredient — not graded on its own." }]);
  });
});
