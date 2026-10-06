import { describe, expect, it } from "vitest";
import { portionMeta } from "./format";

describe("portionMeta", () => {
  it("shows a household portion as its label at ×1", () => {
    expect(portionMeta({ label: "1 katori", amount: 1, unit: "household", grams: 150 })).toBe("1 katori");
  });
  it("prefixes the multiplier for other quantities", () => {
    expect(portionMeta({ label: "1 katori", amount: 2, unit: "household", grams: 300 })).toBe("2 × 1 katori");
  });
  it("shows a 100 g base portion as total grams", () => {
    expect(portionMeta({ label: "100 g", amount: 1.5, unit: "g", grams: 150 })).toBe("150 g");
    expect(portionMeta({ label: "100 ml", amount: 2, unit: "ml", grams: 200 })).toBe("200 ml");
  });
  it("shows free grams as grams", () => {
    expect(portionMeta({ label: "g", amount: 75, unit: "g", grams: 75 })).toBe("75 g");
    expect(portionMeta({ label: "ml", amount: 330, unit: "ml", grams: 330 })).toBe("330 ml");
  });
});
