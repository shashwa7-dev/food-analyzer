import { describe, expect, it } from "vitest";
import { gradeFood } from "./index";

const dal = { energyKcal: 120, protein: 6, carbs: 14, fat: 4.5, fibre: 3.5, sugars: 1.5, satFat: 1.1, sodiumMg: 280 };

describe("gradeFood", () => {
  it("returns no grade for ingredients", () => {
    expect(gradeFood({ gradeCategory: "none", per100: dal })).toEqual({ grade: null, value: null, components: [] });
  });
  it("grades dishes on the frozen reference portion only", () => {
    const a = gradeFood({ gradeCategory: "dish", per100: dal, gradePortionGrams: 150 });
    const b = gradeFood({ gradeCategory: "dish", per100: dal, gradePortionGrams: 150 });
    expect(a).toEqual(b);
    expect(a.grade).toBe("A");
  });
  it("grades a sugary 'water' as a beverage", () => {
    const r = gradeFood({ gradeCategory: "water", per100: { energyKcal: 34, protein: 0, carbs: 8.8, fat: 0, sugars: 8.8 } });
    expect(r.grade).not.toBe("A");
    expect(gradeFood({ gradeCategory: "water", per100: { energyKcal: 0, protein: 0, carbs: 0, fat: 0 } }).grade).toBe("A");
  });
  it("falls back to 250 g for dishes without a reference portion", () => {
    expect(gradeFood({ gradeCategory: "dish", per100: dal, gradePortionGrams: null }).grade).toBe(
      gradeFood({ gradeCategory: "dish", per100: dal, gradePortionGrams: 250 }).grade);
  });
});
