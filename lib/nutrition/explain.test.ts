import { describe, expect, it } from "vitest";
import { explain, INDB_SODIUM_REASON } from "./explain";
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
  it("explains dish density penalties without duplicate reasons", async () => {
    const { dishScore } = await import("./grade/dish");
    const per100 = { energyKcal: 520, protein: 12, carbs: 60, fat: 25, sugars: 44 };
    const reasons = explain({ grade: dishScore(per100, per100), per100, basis: "per_100g", targets: PRESETS.general });
    expect(reasons.some((r) => /High sugar: 44 g per 100 g/.test(r.text))).toBe(true);
    expect(new Set(reasons.map((r) => r.text)).size).toBe(reasons.length);
  });
  it("warns that INDB savoury dishes may not count cooking salt", () => {
    const per100 = { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, sodiumMg: 40 };
    const grade = { grade: "A" as const, value: 95, components: [] };
    const base = { grade, per100, basis: "per_100g" as const, targets: PRESETS.general };
    expect(explain({ ...base, source: "indb", name: "Dal makhani" }).at(-1)).toEqual({ tone: "warn", text: INDB_SODIUM_REASON });
    expect(explain({ ...base, source: "indb", name: "Gulab jamun" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
    expect(explain({ ...base, source: "fndds", name: "Dal" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
    expect(explain({ ...base, per100: { ...per100, sodiumMg: 400 }, source: "indb", name: "Dal makhani" }).some((r) => r.text === INDB_SODIUM_REASON)).toBe(false);
  });
  it("returns an honest note for ungraded foods", () => {
    expect(explain({ grade: { grade: null, value: null, components: [] }, per100: { energyKcal: 900, protein: 0, carbs: 0, fat: 100 }, basis: "per_100g", targets: PRESETS.general }))
      .toEqual([{ tone: "warn", text: "Cooking ingredient — not graded on its own." }]);
  });
});
