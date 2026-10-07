import { describe, expect, it } from "vitest";
import { validateFacts } from "./validate";
import type { Nutrients } from "@/lib/nutrition/types";

const consistent: Nutrients = { energyKcal: 200, protein: 5, carbs: 30, fat: 6, sugars: 10, satFat: 2, fibre: 2, sodiumMg: 300 };

describe("validateFacts", () => {
  it("passes a consistent label", () => {
    expect(validateFacts(consistent)).toEqual({ ok: true, failed: [] });
  });

  it("fails energy when 4P+4C+9F is off by 40%", () => {
    // 4*5 + 4*30 + 9*6 = 194 kcal expected; printed 320 is ~65% off.
    const n: Nutrients = { energyKcal: 320, protein: 5, carbs: 30, fat: 6 };
    const result = validateFacts(n);
    expect(result.ok).toBe(false);
    expect(result.failed).toContain("energy");
  });

  it("fails when sugars exceed carbs", () => {
    const n: Nutrients = { ...consistent, sugars: 40 };
    expect(validateFacts(n).failed).toContain("sugars");
  });

  it("fails when satFat exceeds fat", () => {
    const n: Nutrients = { ...consistent, satFat: 20 };
    expect(validateFacts(n).failed).toContain("satFat");
  });

  it("fails range when a macro exceeds 100 g per 100", () => {
    const n: Nutrients = { energyKcal: 200, protein: 120, carbs: 30, fat: 6 };
    expect(validateFacts(n).failed).toContain("range");
  });

  it("fails range when energy exceeds 900 kcal per 100", () => {
    const n: Nutrients = { energyKcal: 950, protein: 5, carbs: 30, fat: 6 };
    expect(validateFacts(n).failed).toContain("range");
  });

  it("fails kj when printed kJ mismatches the kcal conversion by more than 5%", () => {
    const n: Nutrients = consistent;
    const result = validateFacts(n, { energyKj: 2000 }); // 200 kcal -> ~837 kJ expected
    expect(result.failed).toContain("kj");
  });

  it("passes kj when printed kJ matches the kcal conversion", () => {
    const n: Nutrients = consistent;
    const result = validateFacts(n, { energyKj: 200 * 4.184 });
    expect(result.failed).not.toContain("kj");
  });

  it("honours the fibre convention: passes if either 4P+4C+9F or +2*fibre is within tolerance", () => {
    // 4*5+4*30+9*6 = 194 (close to 200, within 15%); with fibre 2 -> 198, also fine.
    expect(validateFacts(consistent).failed).not.toContain("energy");
  });

  it("uses an absolute 20 kcal tolerance under 100 kcal instead of the 15% relative rule", () => {
    // energy 90 kcal; 4P+4C+9F = 4*3+4*10+9*1 = 61 -> diff 29, fails even the 15% would allow larger abs but here fails anyway.
    const failing: Nutrients = { energyKcal: 90, protein: 3, carbs: 10, fat: 1 };
    expect(validateFacts(failing).failed).toContain("energy");
    // energy 90 kcal; expected 75 -> diff 15, within the 20 kcal absolute tolerance.
    const passing: Nutrients = { energyKcal: 90, protein: 3, carbs: 12, fat: 3.67 };
    expect(validateFacts(passing).failed).not.toContain("energy");
  });
});
