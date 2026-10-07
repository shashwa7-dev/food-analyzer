import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlagNotes } from "@/components/food/sheet-parts";
import type { Flag } from "@/lib/nutrition/types";
import { dietChip, macroShare, NEUTRAL_REASON, oneLineReason, packSize, sodiumLevel, typicalPortion, verdict, warningFlags } from "./result-display";

describe("scan result display", () => {
  it("names a verdict per grade", () => {
    expect(verdict("D")).toBe("Eat now and then");
    expect(verdict(null)).toBe("Not graded");
  });
  it("picks the first bad reason for a low grade and drops its aside", () => {
    const reasons = [
      { tone: "warn", text: "Energy-dense: 541 kcal per 100 g" },
      { tone: "bad", text: "High salt: 560 mg sodium per 100 g · 1 serving is 8% of your daily limit" },
    ] as const;
    expect(oneLineReason([...reasons], "D")).toBe("High salt: 560 mg sodium per 100 g");
    expect(oneLineReason([...reasons], "C")).toBe("High salt: 560 mg sodium per 100 g");
    expect(oneLineReason([reasons[0]], "E")).toBe("Energy-dense: 541 kcal per 100 g");
    expect(oneLineReason([], "C")).toBeNull();
  });
  it("never contradicts the verdict", () => {
    const energyDense = { tone: "warn", text: "Energy-dense: 498 kcal per 100 g" } as const;
    const fibre = { tone: "good", text: "Good fibre: 2.3 g per 100 g" } as const;
    // "Great choice" next to a warning: the best positive reason instead, or a neutral line.
    expect(oneLineReason([energyDense, fibre], "A")).toBe("Good fibre: 2.3 g per 100 g");
    expect(oneLineReason([energyDense], "B")).toBe(NEUTRAL_REASON.good);
    expect(oneLineReason([], "A")).toBe(NEUTRAL_REASON.good);
    // "Best kept rare" next to praise: a neutral line.
    expect(oneLineReason([fibre], "E")).toBe(NEUTRAL_REASON.bad);
    expect(oneLineReason([fibre], null)).toBe("Good fibre: 2.3 g per 100 g");
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

describe("scan result flags", () => {
  const allergen: Flag = { type: "allergen", key: "peanut", severity: "contains", text: "Contains peanut. Check the pack to confirm." };
  const diet: Flag = { type: "diet", key: "vegetarian", severity: "contains", text: "Not vegetarian: contains egg. Check the pack to confirm." };
  const goal: Flag = { type: "goal", key: "sodium", severity: "note", text: "1 serving uses 30% of your daily sodium limit." };

  it("renders allergen and diet sentences in full, as alerts", () => {
    const html = renderToStaticMarkup(createElement(FlagNotes, { flags: warningFlags([allergen, goal, diet]) }));
    expect(html).toContain("Contains peanut. Check the pack to confirm.");
    expect(html).toContain("Not vegetarian: contains egg.");
    expect(html).not.toContain("daily sodium limit");
    expect(html.match(/role="alert"/g)).toHaveLength(2);
  });
  it("only claims a diet fit from a real ingredient list", () => {
    expect(dietChip("vegetarian", [], true)).toEqual({ label: "Veg", fits: true });
    expect(dietChip("vegetarian", [], false)).toBeNull();
    expect(dietChip("none", [], true)).toBeNull();
    expect(dietChip("vegetarian", [diet], false)).toEqual({ label: "Not Veg", fits: false });
  });
});
