import { describe, expect, it } from "vitest";
import { undoBody, undoNeedsPortions, type DeletedEntry } from "./undo";

const base: DeletedEntry = {
  date: "2026-10-07", meal: "lunch", name: "Dal tadka", foodId: "f1", scanId: null,
  portion: { label: "1 katori", amount: 2, unit: "household", grams: 300 },
  nutrients: { energyKcal: 360, protein: 18, carbs: 42, fat: 13.5, sodiumMg: 840 },
};
const portions = [{ label: "1 katori", amount: 1, unit: "household" as const, grams: 150 }, { label: "100 g", amount: 100, unit: "g" as const, grams: 100 }];

describe("undoBody", () => {
  it("re-logs a labelled food portion by index and amount", () => {
    expect(undoBody(base, portions)).toEqual({ kind: "food", date: "2026-10-07", meal: "lunch", foodId: "f1", portionIndex: 0, quantity: 2 });
    expect(undoNeedsPortions(base)).toBe(true);
  });
  it("re-logs free grams by weight without needing portions", () => {
    const e = { ...base, portion: { label: "g", amount: 75, unit: "g" as const, grams: 75 } };
    expect(undoNeedsPortions(e)).toBe(false);
    expect(undoBody(e, null)).toEqual({ kind: "grams", date: "2026-10-07", meal: "lunch", foodId: "f1", grams: 75 });
  });
  it("prefers the scan over the linked food", () => {
    const e = { ...base, scanId: "s1", portion: { label: "ml", amount: 250, unit: "ml" as const, grams: 250 } };
    expect(undoBody(e, null)).toEqual({ kind: "scan_grams", date: "2026-10-07", meal: "lunch", scanId: "s1", grams: 250 });
    expect(undoBody({ ...base, scanId: "s1" }, portions)).toMatchObject({ kind: "scan", scanId: "s1", portionIndex: 0, quantity: 2 });
  });
  it("falls back to a quick add when the portion is gone or there is no source", () => {
    const quick = { kind: "quick", date: "2026-10-07", meal: "lunch", name: "Dal tadka", nutrients: base.nutrients };
    expect(undoBody(base, null)).toEqual(quick);
    expect(undoBody(base, [portions[1]!])).toEqual(quick);
    expect(undoBody({ ...base, foodId: null }, portions)).toEqual(quick);
  });
});
