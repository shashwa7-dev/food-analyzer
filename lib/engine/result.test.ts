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
  it("passes known OFF tags through unchanged (idempotent), so catalogue allergens survive buildResult", () => {
    expect(toOffAllergenTags(["en:milk", "peanut"])).toEqual(["en:milk", "en:peanuts"]);
    expect(toOffAllergenTags(toOffAllergenTags(["milk"]))).toEqual(["en:milk"]);
  });
  it("de-duplicates", () => {
    expect(toOffAllergenTags(["milk", "en:milk"])).toEqual(["en:milk"]);
  });
});

describe("buildResult", () => {
  it("per-serving values of unknown weight: per100 null, perServing kept, ungraded, flags on the one serving", () => {
    const serving: Portion = { label: "1 serving", amount: 1, unit: "serving", grams: null };
    const r = buildResult(baseArgs({ per100: null, perServing: { energyKcal: 160, protein: 4, carbs: 25, fat: 5, sodiumMg: 420 }, portions: [serving], servingUnknown: true,
      profile: { allergies: [], diet: "none", goal: "general", targets: PRESETS.general } }));
    expect(r.per100).toBeNull();
    expect(r.perServing?.energyKcal).toBe(160);
    expect(r.servingUnknown).toBe(true);
    expect(r.grade).toBeNull();
    expect(r.components).toEqual([]);
    expect(r.flags.some((f) => f.key === "sodium")).toBe(true);
  });
  it("stores allergens, may-contain and additives as OFF tags (unmapped OFF tags kept), so Save to my foods can copy them", () => {
    const r = buildResult(baseArgs({ allergens: ["peanut", "en:celery"], mayContain: ["tree_nut", "glitter"], additives: ["en:e330"] }));
    expect(r.allergens).toEqual(["en:peanuts", "en:celery"]);
    expect(r.mayContain).toEqual(["en:nuts"]);
    expect(r.additives).toEqual(["en:e330"]);
  });
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

  it("flags a catalogue allergen given as an OFF tag (barcode path)", () => {
    const result = buildResult(
      baseArgs({ allergens: ["en:peanuts"], profile: { allergies: ["peanut"], diet: "none", goal: "general", targets: PRESETS.general } }),
    );
    expect(result.flags.find((f) => f.type === "allergen" && f.key === "peanut")?.severity).toBe("contains");
  });

  it("uses a stored grade when given instead of recomputing (stored neutral grade everywhere)", () => {
    const stored = { grade: "B" as const, value: 70, components: [] };
    const result = buildResult(baseArgs({ precomputedGrade: stored }));
    expect(result.grade).toBe("B");
    expect(result.gradeValue).toBe(70);
    expect(result.components).toEqual([]);
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

  it("does not throw when the default portion has no grams (serving-unknown case) and uses a 100 g equivalent", () => {
    const unknownServingPortions: Portion[] = [{ label: "1 serving", amount: 1, unit: "serving", grams: null }];
    const result = buildResult(baseArgs({ portions: unknownServingPortions, defaultPortion: 0, servingUnknown: true }));
    expect(result.flags).toBeDefined();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("does not throw when the default portion has grams: 0", () => {
    const zeroGramPortions: Portion[] = [{ label: "1 pinch", amount: 1, unit: "household", grams: 0 }];
    expect(() => buildResult(baseArgs({ portions: zeroGramPortions, defaultPortion: 0 }))).not.toThrow();
  });
});
