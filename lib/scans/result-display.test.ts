import { describe, expect, it } from "vitest";
import { macroShare, oneLineReason, packSize, sodiumLevel, typicalPortion, verdict } from "./result-display";

describe("scan result display", () => {
  it("names a verdict per grade", () => {
    expect(verdict("D")).toBe("Eat now and then");
    expect(verdict(null)).toBe("Not graded");
  });
  it("picks the first bad reason and drops its aside", () => {
    expect(oneLineReason([
      { tone: "warn", text: "Energy-dense: 541 kcal per 100 g" },
      { tone: "bad", text: "High salt: 560 mg sodium per 100 g · 1 serving is 8% of your daily limit" },
    ])).toBe("High salt: 560 mg sodium per 100 g");
    expect(oneLineReason([{ tone: "good", text: "Good protein" }])).toBe("Good protein");
    expect(oneLineReason([])).toBeNull();
  });
  it("splits calories by macro (the mock's peanuts: 16/13/71)", () => {
    expect(macroShare({ protein: 24, carbs: 18.5, fat: 47 })).toEqual({ protein: 16, carbs: 12, fat: 71 });
    expect(macroShare({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
  it("bands sodium per 100 g", () => {
    expect(sodiumLevel(120)).toBe("low");
    expect(sodiumLevel(560)).toBe("medium");
    expect(sodiumLevel(780)).toBe("high");
  });
  it("finds the typical portion and the pack size", () => {
    const portions = [
      { label: "1 serving", amount: 1, unit: "serving" as const, grams: 30 },
      { label: "1 pack", amount: 1, unit: "pack" as const, grams: 150 },
      { label: "100 g", amount: 100, unit: "g" as const, grams: 100 },
    ];
    expect(typicalPortion(portions, 0)?.grams).toBe(30);
    expect(typicalPortion(portions, 2)).toBeNull();
    expect(packSize(portions, "g")).toBe("150 g pack");
    expect(packSize(portions.slice(2), "g")).toBeNull();
  });
});
