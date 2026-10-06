import { describe, expect, it } from "vitest";
import { parseHouseholdCsv, toFoodDraft } from "./seed-map";

const rules = parseHouseholdCsv("keyword,label,grams\ndal|daal,1 katori,150\nroti|chapati,1 roti,40\n");

describe("toFoodDraft", () => {
  it("INDB dish gets household portions, aliases, a frozen grade portion and a grade", () => {
    const d = toFoodDraft({ source: "indb", sourceRef: "ASC100", name: "Dal tadka", basis: "per_100g",
      per100: { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, fibre: 3.5, sugars: 1.5, satFat: 1.1, sodiumMg: 280 },
      portions: [{ label: "1 bowl", amount: 1, unit: "household", grams: 180 }], countries: ["IN"] }, rules);
    expect(d.portions.map((p) => p.label)).toEqual(["1 bowl", "1 katori", "100 g"]);
    expect(d.gradePortionGrams).toBe(180);
    expect(d.kind).toBe("dish");
    expect(d.grade).toBe("A");
    expect(d.provenance.energyKcal).toBe("reference");
    expect(d.normName).toBe("dal tadka");
  });
  it("OFF products are community provenance and keep barcode", () => {
    const d = toFoodDraft({ source: "off", sourceRef: "890", barcode: "890", name: "Bhujia", brand: "Sample", basis: "per_100g",
      per100: { energyKcal: 560, protein: 11, carbs: 42, fat: 38, sugars: 2, satFat: 11, sodiumMg: 1050, fibre: 4 },
      portions: [], categories: ["en:snacks"], countries: ["IN"] }, rules);
    expect(d).toMatchObject({ kind: "packaged", barcode: "890", grade: "E" });
    expect(d.provenance.sodiumMg).toBe("community");
  });
  it("ingredients are not graded", () => {
    const d = toFoodDraft({ source: "indb", sourceRef: "X1", name: "Ghee", basis: "per_100g", per100: { energyKcal: 900, protein: 0, carbs: 0, fat: 100 }, portions: [], countries: ["IN"] }, rules);
    expect(d.grade).toBeNull();
    expect(d.kind).toBe("ingredient");
  });
  it("grades dishes on a real portion of at least 100 g and defaults to it", () => {
    const d = toFoodDraft({ source: "indb", sourceRef: "R1", name: "Chapati/Roti", basis: "per_100g",
      per100: { energyKcal: 260, protein: 8, carbs: 50, fat: 3 }, portions: [{ label: "1 chapati", amount: 1, unit: "household", grams: 36 }], countries: ["IN"] }, []);
    expect(d.gradePortionGrams).toBe(100);
    expect(d.defaultPortion).toBe(0);
  });
  it("skips FNDDS guideline and tiny measures for the grade and default portions", () => {
    const d = toFoodDraft({ source: "fndds", sourceRef: "P1", name: "Pizza, cheese, thin crust", basis: "per_100g", wweia: "Pizza",
      per100: { energyKcal: 280, protein: 12, carbs: 30, fat: 12, satFat: 5, sodiumMg: 600 },
      portions: [{ label: "1 surface inch", amount: 1, unit: "household", grams: 7 }, { label: "Guideline amount per fl oz", amount: 1, unit: "household", grams: 3 },
        { label: "1 piece, large pizza", amount: 1, unit: "household", grams: 120 }], countries: ["US"] }, []);
    expect(d.gradePortionGrams).toBe(120);
    expect(d.defaultPortion).toBe(2);
  });
  it("Apple, raw is a graded generic food with fruit credit", () => {
    const d = toFoodDraft({ source: "fndds", sourceRef: "A1", name: "Apple, raw", basis: "per_100g", wweia: "Apples",
      per100: { energyKcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fibre: 2.4, sugars: 10.4, satFat: 0, sodiumMg: 1 },
      portions: [{ label: "Guideline amount per cup", amount: 1, unit: "household", grams: 3 }, { label: "1 medium", amount: 1, unit: "household", grams: 182 }], countries: ["US"] }, []);
    expect(d).toMatchObject({ kind: "generic", gradeCategory: "general", defaultPortion: 1 });
    expect(["A", "B"]).toContain(d.grade);
    expect(d.categories).toEqual(["wweia:Apples"]);
  });
  it("tonic water is a beverage, not water", () => {
    const d = toFoodDraft({ source: "fndds", sourceRef: "T1", name: "Water, tonic", basis: "per_100g", wweia: "Flavored or carbonated water",
      per100: { energyKcal: 34, protein: 0, carbs: 8.8, fat: 0, sugars: 8.8, sodiumMg: 12 }, portions: [], countries: ["US"] }, []);
    expect(d.gradeCategory).toBe("beverage");
    expect(d.grade).not.toBe("A");
  });
  it("drops bare-unit source portions (1 ml, 1 gm) before computing the base portion", () => {
    const d = toFoodDraft({ source: "indb", sourceRef: "X2", name: "Mango pickle", basis: "per_100g",
      per100: { energyKcal: 300, protein: 2, carbs: 10, fat: 25 },
      portions: [{ label: "1 gm", amount: 1, unit: "g", grams: 1 }, { label: "1 ml", amount: 1, unit: "ml", grams: 1 }],
      countries: ["IN"] }, rules);
    expect(d.portions.map((p) => p.label)).toEqual(["100 g"]);
  });
});
