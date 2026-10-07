import { describe, expect, it } from "vitest";
import { buildResult, toOffAllergenTags } from "./result";
import { PRESETS } from "@/lib/nutrition/targets";
import type { Nutrients, Portion } from "@/lib/nutrition/types";
import type { FoodHit } from "@/lib/foods/types";

const per100: Nutrients = { energyKcal: 250, protein: 10, carbs: 30, fat: 8, sugars: 5, satFat: 3, sodiumMg: 400, fibre: 2 };
const portions: Portion[] = [
  { label: "1 pack", amount: 1, unit: "pack", grams: 40 },
  { label: "100 g", amount: 100, unit: "g", grams: 100 },
];

function baseArgs(overrides: Partial<Parameters<typeof buildResult>[0]> = {}): Parameters<typeof buildResult>[0] {
  return {
    name: "Test Snack", brand: "Acme", foodId: null, kind: "packaged", inputKind: "label",
    basis: "per_100g", per100, provenance: { energyKcal: "label" },
    portions, defaultPortion: 0,
    gradeCategory: "general", gradePortionGrams: null,
    ingredients: [], allergens: [], mayContain: [], additives: [], nova: null,
    alternatives: [] as FoodHit[], hints: [], confidence: "medium",
    profile: { allergies: [], diet: "none", goal: "general", targets: PRESETS.general },
    ...overrides,
  };
}

describe("toOffAllergenTags", () => {
  it("maps model allergen keys to OFF tags", () => {
    expect(toOffAllergenTags(["milk", "peanut"])).toEqual(expect.arrayContaining(["en:milk", "en:peanuts"]));
  });
  it("drops unrecognised keys", () => {
    expect(toOffAllergenTags(["not-a-real-allergen"])).toEqual([]);
  });
});

describe("buildResult", () => {
  it("computes grade, reasons, flags and echoes the per100/provenance through", () => {
    const result = buildResult(baseArgs());
    expect(result.per100).toEqual(per100);
    expect(result.provenance).toEqual({ energyKcal: "label" });
    expect(result.name).toBe("Test Snack");
    expect(result.brand).toBe("Acme");
    expect(result.kind).toBe("packaged");
    expect(result.inputKind).toBe("label");
    expect(result.grade).not.toBeUndefined();
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.flags)).toBe(true);
    expect(Array.isArray(result.components)).toBe(true);
  });

  it("forces confidence to high for barcode input regardless of the passed confidence", () => {
    const result = buildResult(baseArgs({ inputKind: "barcode", confidence: "low" }));
    expect(result.confidence).toBe("high");
  });

  it("keeps the passed confidence for non-barcode input", () => {
    const result = buildResult(baseArgs({ inputKind: "label", confidence: "low" }));
    expect(result.confidence).toBe("low");
  });

  it("flags a declared allergen for an allergic profile (model key mapped to OFF tag before personalise)", () => {
    const result = buildResult(
      baseArgs({
        ingredients: ["milk solids", "sugar", "cocoa"],
        allergens: ["milk"],
        profile: { allergies: ["milk"], diet: "none", goal: "general", targets: PRESETS.general },
      }),
    );
    const milkFlag = result.flags.find((f) => f.type === "allergen" && f.key === "milk");
    expect(milkFlag).toBeDefined();
    expect(milkFlag?.severity).toBe("contains");
  });

  it("passes through tip and servingUnknown", () => {
    const result = buildResult(baseArgs({ tip: "Try a lower-sodium option", servingUnknown: true }));
    expect(result.tip).toBe("Try a lower-sodium option");
    expect(result.servingUnknown).toBe(true);
  });

  it("defaults tip and servingUnknown to undefined when not given", () => {
    const result = buildResult(baseArgs());
    expect(result.tip).toBeUndefined();
    expect(result.servingUnknown).toBeUndefined();
  });
});
