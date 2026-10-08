import { describe, expect, it } from "vitest";
import { burnedSuffix, energyLine } from "./energy";

describe("energyLine", () => {
  it("is null when nothing was burned", () => {
    expect(energyLine(1420, 0, 1700)).toBeNull();
    expect(energyLine(1420, 0.2, 1700)).toBeNull();
  });
  it("returns eaten, burned, net and the unchanged target", () => {
    expect(energyLine(1420, 450, 1700)).toEqual({ eaten: 1420, burned: 450, net: 970, target: 1700 });
  });
  it("rounds to whole kcal and allows a negative net", () => {
    expect(energyLine(199.6, 350.4, 1700.2)).toEqual({ eaten: 200, burned: 350, net: -150, target: 1700 });
  });
});

describe("burnedSuffix", () => {
  it("reads '· 450 burned'", () => {
    expect(burnedSuffix(450)).toBe("· 450 burned");
    expect(burnedSuffix(1234)).toBe("· 1,234 burned");
  });
  it("is empty with no burn", () => {
    expect(burnedSuffix(0)).toBe("");
  });
});
