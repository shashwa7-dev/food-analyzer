import { describe, expect, it } from "vitest";
import { ExtractionSchema, ModelExtractionSchema, sanitiseExtraction } from "./schema";

describe("ExtractionSchema (strict)", () => {
  it("rejects a 200-char product name", () => {
    const raw = { images: [], product: { name: "a".repeat(200) } };
    expect(() => ExtractionSchema.parse(raw)).toThrow();
  });
  it("rejects 81 ingredients", () => {
    const raw = { images: [], ingredients: Array.from({ length: 81 }, (_, i) => `ingredient ${i}`) };
    expect(() => ExtractionSchema.parse(raw)).toThrow();
  });
  it("accepts an all-optional minimal object", () => {
    const raw = { images: [{ index: 0, kind: "nutrition_panel", quality: [] }] };
    expect(() => ExtractionSchema.parse(raw)).not.toThrow();
  });
});

describe("ModelExtractionSchema (lenient)", () => {
  it("tolerates a null product and null facts fields", () => {
    const raw = {
      images: null,
      product: { name: null, brand: null },
      facts: { basis: "per_100g", energyKcal: null, protein: -5 },
    };
    expect(() => ModelExtractionSchema.parse(raw)).not.toThrow();
  });
  it("has no string length cap (unlike the strict schema)", () => {
    const raw = { product: { name: "a".repeat(500) } };
    expect(() => ModelExtractionSchema.parse(raw)).not.toThrow();
  });
  it("has no array length cap", () => {
    const raw = { ingredients: Array.from({ length: 200 }, (_, i) => `ingredient ${i}`) };
    expect(() => ModelExtractionSchema.parse(raw)).not.toThrow();
  });
});

describe("sanitiseExtraction", () => {
  it("truncates an over-long name instead of rejecting it", () => {
    const raw = ModelExtractionSchema.parse({ product: { name: "a".repeat(200) } });
    const out = sanitiseExtraction(raw);
    expect(out.product?.name.length).toBe(120);
  });
  it("tolerates null fields, converting them to undefined", () => {
    const raw = ModelExtractionSchema.parse({ product: { name: "Snack", brand: null, variant: null } });
    const out = sanitiseExtraction(raw);
    expect(out.product?.brand).toBeUndefined();
    expect(out.product?.variant).toBeUndefined();
  });
  it("drops a negative protein value rather than throwing", () => {
    const raw = ModelExtractionSchema.parse({
      facts: { basis: "per_100g", energyKcal: 200, protein: -5, carbs: 10, fat: 5 },
    });
    const out = sanitiseExtraction(raw);
    expect(out.facts?.protein).toBeUndefined();
    expect(out.facts?.energyKcal).toBe(200);
    expect(out.facts?.carbs).toBe(10);
  });
  it("slices ingredients to 80 and truncates each to 80 chars", () => {
    const raw = ModelExtractionSchema.parse({
      ingredients: Array.from({ length: 90 }, () => "x".repeat(100)),
    });
    const out = sanitiseExtraction(raw);
    expect(out.ingredients).toHaveLength(80);
    expect(out.ingredients?.[0]?.length).toBe(80);
  });
  it("caps images at 3 and quality at 4", () => {
    const raw = ModelExtractionSchema.parse({
      images: [
        { index: 0, kind: "front", quality: ["blurry", "glare", "cropped", "too_dark", "blurry"] },
        { index: 1, kind: "nutrition_panel", quality: [] },
        { index: 2, kind: "ingredients", quality: [] },
        { index: 2, kind: "barcode", quality: [] },
      ],
    });
    const out = sanitiseExtraction(raw);
    expect(out.images).toHaveLength(3);
    expect(out.images[0].quality.length).toBeLessThanOrEqual(4);
  });
  it("defaults images to an empty array when missing", () => {
    const out = sanitiseExtraction(ModelExtractionSchema.parse({}));
    expect(out.images).toEqual([]);
  });
  it("returns a value that satisfies the strict ExtractionSchema", () => {
    const raw = ModelExtractionSchema.parse({
      product: { name: "a".repeat(200), brand: null },
      facts: { basis: "per_100g", energyKcal: 200, protein: -5, carbs: 10, fat: 5, sodiumMg: 999999 },
      ingredients: Array.from({ length: 90 }, () => "x".repeat(100)),
    });
    const out = sanitiseExtraction(raw);
    expect(() => ExtractionSchema.parse(out)).not.toThrow();
  });
});
