import { describe, expect, it } from "vitest";
import { logEntryBody, stepQuantity } from "./quantity";

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

describe("logEntryBody", () => {
  const base = { date: "2026-10-07", meal: "lunch" };
  it("logs a food by portion or by custom grams", () => {
    expect(logEntryBody({ kind: "food", foodId: "f" }, { ...base, portionIndex: 1, quantity: 2 }))
      .toEqual({ kind: "food", ...base, foodId: "f", portionIndex: 1, quantity: 2 });
    expect(logEntryBody({ kind: "food", foodId: "f" }, { ...base, grams: 150 })).toEqual({ kind: "grams", ...base, foodId: "f", grams: 150 });
  });
  it("logs a scan with the scan kinds", () => {
    expect(logEntryBody({ kind: "scan", scanId: "s" }, { ...base, portionIndex: 0, quantity: 0.5 }))
      .toEqual({ kind: "scan", ...base, scanId: "s", portionIndex: 0, quantity: 0.5 });
    expect(logEntryBody({ kind: "scan", scanId: "s" }, { ...base, grams: 80 })).toEqual({ kind: "scan_grams", ...base, scanId: "s", grams: 80 });
  });
});
