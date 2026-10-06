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
  it("FNDDS uses WWEIA categories", () => {
    expect(classify({ source: "fndds", name: "Chicken curry", wweia: "Poultry mixed dishes" }).gradeCategory).toBe("dish");
    expect(classify({ source: "fndds", name: "Coffee, with milk", wweia: "Coffee" }).gradeCategory).toBe("beverage");
    expect(classify({ source: "fndds", name: "Water, tap", wweia: "Tap water" }).gradeCategory).toBe("water");
    expect(classify({ source: "fndds", name: "Olive oil", wweia: "Salad dressings and vegetable oils" })).toEqual({ kind: "ingredient", gradeCategory: "none" });
    expect(classify({ source: "fndds", name: "Rice, white, cooked", wweia: "Rice" })).toEqual({ kind: "generic", gradeCategory: "general" });
    expect(classify({ source: "fndds", name: "Rice flour, raw", wweia: "Flours" })).toEqual({ kind: "ingredient", gradeCategory: "general" });
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
