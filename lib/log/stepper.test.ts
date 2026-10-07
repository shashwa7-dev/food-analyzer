import { describe, expect, it } from "vitest";
import { formatAmount, multiplierUnit, stepAmount, stepFor, unitChipLabel, unitWord } from "./stepper";
describe("stepper", () => {
  it("steps household/serving/pack by a half and grams/ml by 10", () => {
    expect(stepFor("household")).toBe(0.5); expect(stepFor("serving")).toBe(0.5); expect(stepFor("pack")).toBe(0.5);
    expect(stepFor("g")).toBe(10); expect(stepFor("ml")).toBe(10);
  });
  it("never goes below one step", () => {
    expect(stepAmount(0.5, "household", -1)).toBe(0.5);
    expect(stepAmount(10, "g", -1)).toBe(10);
  });
  it("snaps odd values to the step grid", () => {
    expect(stepAmount(37, "g", 1)).toBe(40);
    expect(stepAmount(37, "g", -1)).toBe(30);
    expect(stepAmount(1.2, "household", 1)).toBe(1.5);
  });
  it("formats halves as fractions", () => {
    expect(formatAmount(1.5)).toBe("1½"); expect(formatAmount(0.5)).toBe("½"); expect(formatAmount(2)).toBe("2"); expect(formatAmount(150)).toBe("150");
  });
  it("formats quarters as fractions", () => {
    expect(formatAmount(0.25)).toBe("¼"); expect(formatAmount(0.75)).toBe("¾");
    expect(formatAmount(1.25)).toBe("1¼"); expect(formatAmount(2.75)).toBe("2¾");
    expect(formatAmount(37.5)).toBe("37½"); expect(formatAmount(1.3)).toBe("1.3");
  });
});

describe("multiplierUnit", () => {
  it("steps a g/ml portion's multiplier by halves", () => {
    expect(multiplierUnit("g")).toBe("serving"); expect(multiplierUnit("ml")).toBe("serving");
    expect(stepFor(multiplierUnit("g"))).toBe(0.5);
  });
  it("leaves household, serving and pack alone", () => {
    expect(multiplierUnit("household")).toBe("household"); expect(multiplierUnit("serving")).toBe("serving"); expect(multiplierUnit("pack")).toBe("pack");
  });
});

describe("unit words", () => {
  it("drops the leading 1 and pluralises plain count nouns from 2 up", () => {
    expect(unitWord("1 katori", 1.5)).toBe("katori");
    expect(unitWord("1 piece", 2)).toBe("pieces");
    expect(unitWord("1 glass", 3)).toBe("glasses");
    expect(unitWord("1 patty", 2)).toBe("patties");
    expect(unitWord("1 serving", 1)).toBe("serving");
  });
  it("leaves sizes and phrases alone", () => {
    expect(unitWord("1 large", 2)).toBe("large");
    expect(unitWord("1 cup, cooked", 2)).toBe("cup, cooked");
    expect(unitWord("1 fl oz (no ice)", 2)).toBe("fl oz (no ice)");
  });
  it("multiplies labels that don't start with one", () => {
    expect(unitWord("4 cubes", 1)).toBe("4 cubes");
    expect(unitWord("4 cubes", 2)).toBe("× 4 cubes");
  });
  it("capitalises chip labels", () => {
    expect(unitChipLabel("1 katori")).toBe("Katori");
    expect(unitChipLabel("1 fl oz (no ice)")).toBe("Fl oz (no ice)");
    expect(unitChipLabel("4 cubes")).toBe("4 cubes");
  });
});
