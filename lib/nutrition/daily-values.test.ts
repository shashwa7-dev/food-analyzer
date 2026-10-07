import { describe, expect, it } from "vitest";
import { DAILY_VALUES, percentDV } from "./daily-values";
import { MICRO_KEYS } from "./types";

describe("percentDV", () => {
  it("has a Daily Value for every micro", () => {
    for (const k of MICRO_KEYS) expect(DAILY_VALUES[k], k).toBeGreaterThan(0);
  });

  it("uses the FDA 2,000 kcal adult values", () => {
    expect(percentDV("calciumMg", 130)).toBe(10); // DV 1,300 mg
    expect(percentDV("ironMg", 18)).toBe(100);
    expect(percentDV("vitaminCMg", 45)).toBe(50);
    expect(percentDV("vitaminB12Ug", 1.2)).toBe(50);
    expect(percentDV("sodiumMg", 2_300)).toBe(100);
  });

  it("rounds to a whole percent and can pass 100", () => {
    expect(percentDV("vitaminAUg", 30_000)).toBe(3333); // cod liver oil
    expect(percentDV("zincMg", 0.04)).toBe(0);
  });

  it("is null without a Daily Value or a usable amount", () => {
    expect(percentDV("sugars", 10)).toBeNull();
    expect(percentDV("transFat", 1)).toBeNull();
    expect(percentDV("ironMg", undefined)).toBeNull();
    expect(percentDV("ironMg", Number.NaN)).toBeNull();
    expect(percentDV("ironMg", -1)).toBeNull();
  });
});
