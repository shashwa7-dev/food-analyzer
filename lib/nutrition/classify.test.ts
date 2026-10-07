import { describe, expect, it } from "vitest";
import { classify } from "./classify";

describe("classify", () => {
  it("INDB recipes are dishes; cooking basics are not graded", () => {
    expect(classify({ source: "indb", name: "Dal tadka" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Ghee" })).toEqual({ kind: "ingredient", gradeCategory: "none" });
    expect(classify({ source: "indb", name: "Garam masala powder" })).toEqual({ kind: "ingredient", gradeCategory: "none" });
    expect(classify({ source: "indb", name: "Paneer butter masala" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Butter chicken" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Honey chilli potato" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Mustard oil" })).toEqual({ kind: "ingredient", gradeCategory: "none" });
  });
  it("INDB dishes 'with' a basic ingredient are dishes", () => {
    expect(classify({ source: "indb", name: "Gulab jamun with milk powder" })).toEqual({ kind: "dish", gradeCategory: "dish" });
  });
  it("INDB cooked dishes are not misclassified as raw ingredients", () => {
    expect(classify({ source: "indb", name: "Gram flour and semolina dhokla" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Chickpea flour cookies" })).toEqual({ kind: "dish", gradeCategory: "dish" });
    expect(classify({ source: "indb", name: "Cabbage rolls (dry)" })).toEqual({ kind: "dish", gradeCategory: "dish" });
  });
  it("FNDDS uses WWEIA categories", () => {
    expect(classify({ source: "fndds", name: "Chicken curry", wweia: "Poultry mixed dishes" }).gradeCategory).toBe("dish");
    expect(classify({ source: "fndds", name: "Coffee, with milk", wweia: "Coffee" }).gradeCategory).toBe("beverage");
    expect(classify({ source: "fndds", name: "Water, tap", wweia: "Tap water" }).gradeCategory).toBe("water");
    expect(classify({ source: "fndds", name: "Olive oil", wweia: "Salad dressings and vegetable oils" })).toEqual({ kind: "ingredient", gradeCategory: "none" });
    expect(classify({ source: "fndds", name: "Rice, white, cooked", wweia: "Rice" })).toEqual({ kind: "generic", gradeCategory: "general" });
    expect(classify({ source: "fndds", name: "Rice flour, raw", wweia: "Flours" })).toEqual({ kind: "ingredient", gradeCategory: "general" });
  });
  it("FNDDS raw fruit and vegetables are generic foods with full fruit/veg credit", () => {
    expect(classify({ source: "fndds", name: "Apple, raw", wweia: "Apples" })).toEqual({ kind: "generic", gradeCategory: "general", fvlPercent: 100 });
    expect(classify({ source: "fndds", name: "Spinach, raw", wweia: "Spinach" })).toEqual({ kind: "generic", gradeCategory: "general", fvlPercent: 100 });
    expect(classify({ source: "fndds", name: "Rice flour, raw", wweia: "Flours" })).toEqual({ kind: "ingredient", gradeCategory: "general" });
    expect(classify({ source: "fndds", name: "Chicken, raw", wweia: "Chicken, whole pieces" })).toEqual({ kind: "ingredient", gradeCategory: "general" });
    expect(classify({ source: "fndds", name: "Potato chips", wweia: "Potato chips" }).fvlPercent).toBeUndefined();
    expect(classify({ source: "fndds", name: "French fries", wweia: "French fries and other fried white potatoes" }).fvlPercent).toBeUndefined();
    expect(classify({ source: "fndds", name: "Apple juice", wweia: "Apple juice" }).fvlPercent).toBeUndefined();
    expect(classify({ source: "fndds", name: "Fruit punch", wweia: "Fruit drinks" }).fvlPercent).toBeUndefined();
  });
  it("only near-zero sugar and energy drinks count as water", () => {
    const tonic = { energyKcal: 34, protein: 0, carbs: 8.8, fat: 0, sugars: 8.8 };
    expect(classify({ source: "fndds", name: "Water, tonic", wweia: "Flavored or carbonated water", per100: tonic }).gradeCategory).toBe("beverage");
    expect(classify({ source: "off", name: "Tonic", categories: ["en:beverages", "en:waters"], per100: tonic }).gradeCategory).toBe("beverage");
    expect(classify({ source: "off", name: "Mineral water", categories: ["en:waters"], per100: { energyKcal: 0, protein: 0, carbs: 0, fat: 0 } }).gradeCategory).toBe("water");
  });
  it("OFF uses category tags", () => {
    expect(classify({ source: "off", name: "Cola", categories: ["en:beverages", "en:sodas"] }).gradeCategory).toBe("beverage");
    expect(classify({ source: "off", name: "Mineral water", categories: ["en:beverages", "en:waters"] }).gradeCategory).toBe("water");
    expect(classify({ source: "off", name: "Mustard oil", categories: ["en:fats", "en:vegetable-oils"] }).gradeCategory).toBe("fat_oil");
    expect(classify({ source: "off", name: "Bhujia", categories: ["en:snacks"] })).toEqual({ kind: "packaged", gradeCategory: "general" });
  });
  it("custom foods entered per serving are dishes", () => {
    expect(classify({ source: "custom", name: "Mom's rajma", perServingEntry: true }).gradeCategory).toBe("dish");
    expect(classify({ source: "custom", name: "Protein bar", perServingEntry: false }).gradeCategory).toBe("general");
  });
});
