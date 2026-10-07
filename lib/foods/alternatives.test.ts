import { describe, expect, it } from "vitest";
import { closeness, foodForm, isRelevantAlternative, specificCategories } from "./alternatives";

// Category tags as stored for real OFF India products (2026-10-08).
const paneer = { name: "Paneer", gradeCategory: "cheese", basis: "per_100g", categories: ["en:dairies", "en:fermented-foods", "en:fermented-milk-products", "en:cheeses", "en:paneer"] };
const malaiPaneer = { ...paneer, name: "Malai Paneer" };
const milk = { name: "Amul Taaza Milky Milk", gradeCategory: "general", basis: "per_100g", categories: ["en:dairies", "en:milks-liquid-and-powder", "en:milks", "en:pasteurised-products", "en:pasteurised-milks", "en:whole-milks", "en:whole-pasteurised-milks"] };
const tonedMilk = { name: "Amul Taaza 1ltr", gradeCategory: "general", basis: "per_100g", categories: ["en:dairies", "en:milks-liquid-and-powder", "en:milks", "en:buffalo-milks", "en:toned-milks", "en:whole-milks"] };
const milkPowder = { name: "Amulya dairy whitener", gradeCategory: "general", basis: "per_100g", categories: ["en:dairies", "en:milks-liquid-and-powder", "en:milk-powders", "en:milks"] };
const curd = { name: "Curd", gradeCategory: "general", basis: "per_100g", categories: ["en:dairies", "en:fermented-foods", "en:fermented-milk-products", "en:desserts", "en:dairy-desserts", "en:fermented-dairy-desserts", "en:yogurts", "en:curd"] };
const dahi = { ...curd, name: "Dahi", categories: [...curd.categories.slice(0, 7), "en:plain-yogurts"] };
const bhujia = { name: "Bhujia sev 200g", gradeCategory: "general", basis: "per_100g", categories: ["en:snacks", "en:salty-snacks", "en:appetizers"] };
const crisps = { name: "Haldiram's Bhujia", gradeCategory: "general", basis: "per_100g", categories: ["en:snacks", "en:salty-snacks", "en:appetizers", "en:chips-and-fries", "en:crisps"] };
const biscuit = { name: "Marie biscuit", gradeCategory: "general", basis: "per_100g", categories: ["en:snacks", "en:sweet-snacks", "en:biscuits-and-cakes", "en:biscuits"] };

describe("better-pick relevance", () => {
  it("never pairs Paneer with milk: only en:dairies is shared, and one is drunk", () => {
    expect(isRelevantAlternative(paneer, milk)).toBe(false);
    expect(foodForm(paneer)).toBe("solid");
    expect(foodForm(milk)).toBe("liquid");
  });

  it("pairs Paneer with another paneer", () => {
    expect(isRelevantAlternative(paneer, malaiPaneer)).toBe(true);
  });

  it("doesn't offer curd for paneer: sharing fermented-milk-products is still only the aisle", () => {
    expect(isRelevantAlternative(paneer, curd)).toBe(false);
  });

  it("pairs milk with milk, but not with milk powder (a different form)", () => {
    expect(isRelevantAlternative(tonedMilk, milk)).toBe(true);
    expect(foodForm(milkPowder)).toBe("powder");
    expect(isRelevantAlternative(tonedMilk, milkPowder)).toBe(false);
  });

  it("pairs curd with dahi (most of the branch shared) and not with paneer", () => {
    expect(isRelevantAlternative(curd, dahi)).toBe(true);
    expect(isRelevantAlternative(curd, paneer)).toBe(false);
  });

  it("pairs a namkeen with other salty snacks, never with a sweet biscuit", () => {
    expect(isRelevantAlternative(bhujia, crisps)).toBe(true);
    expect(isRelevantAlternative(bhujia, biscuit)).toBe(false);
  });

  it("gives no pick at all when a food has only aisle-level tags", () => {
    const snack = { name: "Bikaneri Bhujia", categories: ["en:snacks"] };
    expect(specificCategories(snack.categories)).toEqual([]);
    expect(isRelevantAlternative(snack, { name: "Roasted chana", categories: ["en:snacks"] })).toBe(false);
  });

  it("needs half of the food's categories shared, not just one specific one", () => {
    const a = { name: "x", categories: ["en:cheeses", "en:a", "en:b", "en:c"] };
    expect(isRelevantAlternative(a, { name: "y", categories: ["en:cheeses"] })).toBe(false);
    expect(isRelevantAlternative(a, { name: "y", categories: ["en:cheeses", "en:a"] })).toBe(true);
  });

  it("reads drinks from the grading category, the basis, the tags and the name", () => {
    expect(foodForm({ name: "Cola", categories: [], gradeCategory: "beverage" })).toBe("liquid");
    expect(foodForm({ name: "Juice", categories: [], basis: "per_100ml" })).toBe("liquid");
    expect(foodForm({ name: "Masala chaas", categories: [] })).toBe("liquid");
    expect(foodForm({ name: "Bournvita", categories: ["en:beverages", "en:beverage-preparations"] })).toBe("powder");
  });

  it("ranks the closest first: more shared tags, then the same grading category, then the same name family", () => {
    expect(closeness(paneer, malaiPaneer)).toBeGreaterThan(closeness(paneer, { ...malaiPaneer, gradeCategory: "general" }));
    expect(closeness(curd, dahi)).toBeGreaterThan(closeness(curd, { ...dahi, categories: dahi.categories.slice(0, 5) }));
  });
});
