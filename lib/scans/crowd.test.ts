import { describe, expect, it } from "vitest";
import { crowdDraft } from "./crowd";
import type { CrowdCandidate } from "@/lib/engine";
import { GRADE_VERSION } from "@/lib/nutrition/grade";

const candidate: CrowdCandidate = {
  name: "Aloo Bhujia", brand: "Shree Rama", barcode: "8901491101837", basis: "per_100g",
  per100: { energyKcal: 554, protein: 11, carbs: 51.7, fat: 34, sugars: 2, satFat: 15.2, sodiumMg: 1050, fibre: 4.1 },
  portions: [{ label: "1 serving", amount: 1, unit: "serving", grams: 30 }, { label: "1 pack", amount: 1, unit: "pack", grams: 200 }, { label: "100 g", amount: 100, unit: "g", grams: 100 }],
  ingredients: ["Gram flour"], allergens: [], mayContain: ["en:milk"], additives: ["en:e330"], categories: ["en:snacks"],
};

describe("crowdDraft", () => {
  it("builds a shared crowd food: graded, label provenance, search fields, the scanner's country, no owner or image", () => {
    const d = crowdDraft(candidate, "IN");
    expect(d).toMatchObject({
      source: "crowd", sourceRef: null, ownerId: null, kind: "packaged", gradeCategory: "general", name: "Aloo Bhujia", brand: "Shree Rama",
      barcode: "8901491101837", basis: "per_100g", countries: ["IN"], imageUrl: null, gradeVersion: GRADE_VERSION,
      normName: "aloo bhujia", normBrand: "shree rama", ingredients: ["Gram flour"], mayContain: ["en:milk"], additives: ["en:e330"],
      categories: ["en:snacks"], gradePortionGrams: null,
    });
    expect(d.grade).toMatch(/^[A-E]$/);
    expect(d.provenance).toEqual({ energyKcal: "label", protein: "label", carbs: "label", fat: "label", sugars: "label", satFat: "label", sodiumMg: "label", fibre: "label" });
    expect(d.portions).toEqual(candidate.portions);
    expect(d.portions[d.defaultPortion!]!.label).toBe("1 serving");
    expect(d.searchName).toContain("aloo bhujia");
  });

  it("classifies by category (beverage) and keeps a null barcode", () => {
    const d = crowdDraft({ ...candidate, barcode: null, basis: "per_100ml", categories: ["en:beverages"], per100: { energyKcal: 40, protein: 0, carbs: 10, fat: 0, sugars: 10 } }, "US");
    expect(d.gradeCategory).toBe("beverage");
    expect(d.barcode).toBeNull();
    expect(d.countries).toEqual(["US"]);
  });
});
