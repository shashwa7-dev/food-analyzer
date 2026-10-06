import { describe, expect, it } from "vitest";
import { offRowFromParquet, toSourceRecordFNDDS, toSourceRecordINDB, toSourceRecordOFF } from "./fetch-sources";

describe("INDB mapping", () => {
  it("maps per-100 g nutrients and derives serving grams from kcal", () => {
    const r = toSourceRecordINDB({
      food_code: "ASC001", food_name: "Hot tea (Garam Chai)", energy_kcal: 16.1443, carb_g: 2.582, protein_g: 0.388, fat_g: 0.532,
      freesugar_g: 2.576, fibre_g: 0, sfa_mg: 321.5, sodium_mg: 3.12, servings_unit: "tea cup", unit_serving_energy_kcal: 33.98,
    })!;
    expect(r).toMatchObject({ source: "indb", sourceRef: "ASC001", name: "Hot tea (Garam Chai)", basis: "per_100g", countries: ["IN"] });
    expect(r.per100.satFat).toBeCloseTo(0.322, 3);
    expect(r.per100.addedSugars).toBeCloseTo(2.576, 3);
    expect(r.portions[0]).toEqual({ label: "1 tea cup", amount: 1, unit: "household", grams: 210 });
  });
  it("drops rows without energy", () => {
    expect(toSourceRecordINDB({ food_code: "X", food_name: "Y", energy_kcal: null })).toBeNull();
  });
});

describe("FNDDS mapping", () => {
  it("reads nutrient numbers and portions", () => {
    const r = toSourceRecordFNDDS({
      fdcId: 1, description: "Milk, whole", wweiaFoodCategory: { wweiaFoodCategoryDescription: "Milk, whole" },
      foodNutrients: [
        { nutrient: { number: "208" }, amount: 61 }, { nutrient: { number: "203" }, amount: 3.27 }, { nutrient: { number: "205" }, amount: 4.63 },
        { nutrient: { number: "204" }, amount: 3.2 }, { nutrient: { number: "269" }, amount: 4.81 }, { nutrient: { number: "291" }, amount: 0 },
        { nutrient: { number: "606" }, amount: 1.86 }, { nutrient: { number: "307" }, amount: 38 },
      ],
      foodPortions: [{ portionDescription: "Quantity not specified", gramWeight: 0 }, { portionDescription: "1 cup", gramWeight: 244 }],
    })!;
    expect(r.per100).toEqual({ energyKcal: 61, protein: 3.27, carbs: 4.63, fat: 3.2, sugars: 4.81, fibre: 0, satFat: 1.86, sodiumMg: 38 });
    expect(r.portions).toEqual([{ label: "1 cup", amount: 1, unit: "household", grams: 244 }]);
    expect(r.wweia).toBe("Milk, whole");
  });
});

describe("OFF mapping", () => {
  it("maps nutriments and requires energy and macros", () => {
    const r = toSourceRecordOFF({
      code: "8901491101837", product_name: "Aloo Bhujia", brands: "Sample", categories_tags: ["en:snacks"],
      nutriments: { "energy-kcal_100g": 554, proteins_100g: 11, carbohydrates_100g: 51.7, fat_100g: 34, "saturated-fat_100g": 11, sugars_100g: 2, fiber_100g: 4, sodium_100g: 1.05 },
      serving_quantity: 30, product_quantity: 200, nova_group: 4, additives_tags: ["en:e627"], allergens_tags: [], ingredients_text: "gram flour, palmolein, salt",
    })!;
    expect(r.per100.sodiumMg).toBe(1050);
    expect(r.portions.map((p) => p.label)).toEqual(["1 serving", "1 pack"]);
    expect(r.ingredients).toEqual(["gram flour", "palmolein", "salt"]);
    expect(toSourceRecordOFF({ code: "1", product_name: "x", nutriments: {} })).toBeNull();
  });
});

describe("offRowFromParquet", () => {
  it("adapts the observed OFF Parquet row shape (DESCRIBE, 2026-10-06)", () => {
    // Real shape sampled from the HF Parquet export, filtered to en:india, 2026-10-06:
    // product_name / ingredients_text are STRUCT(lang, text)[]; nutriments is
    // STRUCT(name, value, "100g", serving, unit, prepared_*)[]; serving_quantity /
    // product_quantity are VARCHAR numeric strings; grade column is nutriscore_grade.
    const raw = {
      code: "00024907",
      product_name: [
        { lang: "main", text: "Teriyaki Dip Sauce Marinade" },
        { lang: "fr", text: "Teriyaki" },
        { lang: "en", text: "Teriyaki Dip Sauce Marinade" },
      ],
      brands: "Marks & Spencer",
      categories_tags: ["en:condiments", "en:sauces", "en:barbecue-sauces"],
      nutriments: [
        { name: "sugars", "100g": 33.9 },
        { name: "energy-kcal", "100g": 170 },
        { name: "salt", "100g": 2.58 },
        { name: "saturated-fat", "100g": 0.1 },
        { name: "carbohydrates", "100g": 39.4 },
        { name: "fat", "100g": 0.3 },
        { name: "proteins", "100g": 2 },
        { name: "sodium", "100g": 1.032 },
        { name: "fiber", "100g": 0.8 },
      ],
      serving_quantity: null,
      product_quantity: "305",
      nova_group: null,
      additives_tags: [],
      allergens_tags: ["en:gluten"],
      traces_tags: [],
      ingredients_text: [
        { lang: "main", text: "Sugar, water, dark soy sauce" },
        { lang: "en", text: "Sugar, water, dark soy sauce" },
      ],
      nutriscore_grade: "e",
    };
    const row = offRowFromParquet(raw);
    expect(row).toMatchObject({
      code: "00024907", product_name: "Teriyaki Dip Sauce Marinade", brands: "Marks & Spencer",
      product_quantity: "305", serving_quantity: null, nutrition_grades: "e",
      ingredients_text: "Sugar, water, dark soy sauce",
    });
    expect(row.nutriments).toMatchObject({ "sugars_100g": 33.9, "energy-kcal_100g": 170, salt_100g: 2.58, sodium_100g: 1.032 });
    const rec = toSourceRecordOFF(row)!;
    expect(rec.name).toBe("Teriyaki Dip Sauce Marinade");
    expect(rec.per100.sodiumMg).toBeCloseTo(1032, 0);
    expect(rec.nutriscore).toBe("e");
    expect(rec.portions.map((p) => p.label)).toEqual(["1 pack"]);
  });
});
