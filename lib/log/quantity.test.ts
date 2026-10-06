import { describe, expect, it } from "vitest";
import { stepQuantity } from "./quantity";

describe("stepQuantity", () => {
  it("steps by halves below 1 and wholes above", () => {
    expect(stepQuantity(1, 1)).toBe(2);
    expect(stepQuantity(1, -1)).toBe(0.5);
    expect(stepQuantity(0.5, -1)).toBe(0.25);
    expect(stepQuantity(0.5, 1)).toBe(1);
    expect(stepQuantity(3, -1)).toBe(2);
  });
  it("clamps to 0.25–20", () => {
    expect(stepQuantity(0.25, -1)).toBe(0.25);
    expect(stepQuantity(20, 1)).toBe(20);
  });
});
